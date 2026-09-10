'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // ฟอร์มสำหรับเพิ่มสินค้าเข้าตะกร้า
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

  // ตะกร้าสินค้าที่จะขาย (หลายรายการ)
  // แต่ละชิ้น: { productId, sku, name, price, unit, stock, quantity }
  const [cart, setCart] = useState([]);

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // โหลดรายการสินค้าจาก Supabase
  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // จำนวนของสินค้าตัวนี้ที่ถูกใส่ในตะกร้าไปแล้ว (กันเลือกซ้ำเกิน stock)
  const qtyAlreadyInCart = (productId) =>
    cart
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.quantity, 0);

  // เพิ่มสินค้าลงตะกร้า
  const handleAddToCart = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct) {
      setErrorMsg('กรุณาเลือกสินค้า');
      return;
    }
    const qtyNumber = parseInt(quantity, 10) || 0;
    if (qtyNumber <= 0) {
      setErrorMsg('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }

    const alreadyInCart = qtyAlreadyInCart(selectedProduct.id);
    if (alreadyInCart + qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit}, ในตะกร้ามีแล้ว ${alreadyInCart})`
      );
      return;
    }

    // ถ้ามีสินค้านี้ในตะกร้าอยู่แล้ว ให้รวมจำนวนเข้าด้วยกัน
    const existingIndex = cart.findIndex(
      (item) => item.productId === selectedProduct.id
    );

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += qtyNumber;
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          productId: selectedProduct.id,
          sku: selectedProduct.sku,
          name: selectedProduct.name,
          price: selectedProduct.price,
          unit: selectedProduct.unit,
          stock: selectedProduct.stock,
          quantity: qtyNumber,
        },
      ]);
    }

    // ล้างฟอร์มเพิ่มสินค้า (แต่ยังอยู่หน้าเดิมเพื่อเพิ่มรายการถัดไป)
    setSelectedProductId('');
    setQuantity('');
  };

  // ลบรายการออกจากตะกร้า
  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter((item) => item.productId !== productId));
  };

  // แก้จำนวนสินค้าในตะกร้าโดยตรง
  const handleCartQtyChange = (productId, newQty) => {
    const qtyNumber = parseInt(newQty, 10) || 0;
    setCart(
      cart.map((item) =>
        item.productId === productId ? { ...item, quantity: qtyNumber } : item
      )
    );
  };

  // ยอดรวมทั้งหมดในตะกร้า
  const grandTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const resetCart = () => {
    setCart([]);
    setSelectedProductId('');
    setQuantity('');
  };

  // กดยืนยันการขายทั้งตะกร้า
  const handleCheckout = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (cart.length === 0) {
      setErrorMsg('กรุณาเพิ่มสินค้าลงตะกร้าก่อน');
      return;
    }
    if (cart.some((item) => item.quantity <= 0)) {
      setErrorMsg('มีรายการที่จำนวนไม่ถูกต้อง กรุณาตรวจสอบตะกร้า');
      return;
    }

    setSubmitting(true);

    // ตรวจสอบ stock ล่าสุดอีกครั้งก่อนบันทึก (กันข้อมูลเก่าค้าง)
    const { data: freshProducts, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .in('id', cart.map((item) => item.productId));

    if (fetchError) {
      setErrorMsg(fetchError.message);
      setSubmitting(false);
      return;
    }

    for (const item of cart) {
      const fresh = freshProducts.find((p) => p.id === item.productId);
      if (!fresh || fresh.stock < item.quantity) {
        setErrorMsg(
          `สินค้า "${item.name}" คงเหลือไม่เพียงพอ (คงเหลือจริง ${fresh ? fresh.stock : 0})`
        );
        setSubmitting(false);
        return;
      }
    }

    // 1) บันทึกทุกรายการในตะกร้าลงตาราง sales (insert เป็นชุดเดียว)
    const salesRows = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      total_price: item.price * item.quantity,
      sold_at: new Date().toISOString(),
    }));

    const { error: saleError } = await supabase.from('sales').insert(salesRows);

    if (saleError) {
      setErrorMsg(saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ของสินค้าแต่ละตัวในตะกร้า
    for (const item of cart) {
      const fresh = freshProducts.find((p) => p.id === item.productId);
      const newStock = fresh.stock - item.quantity;
      const { error: stockError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', item.productId);

      if (stockError) {
        setErrorMsg(stockError.message);
        setSubmitting(false);
        return;
      }
    }

    // สำเร็จ: แจ้งเตือน ล้างตะกร้า และโหลดสินค้าใหม่
    setSuccessMsg(
      `ขายสำเร็จ ${cart.length} รายการ รวม ${grandTotal.toFixed(2)} บาท`
    );
    resetCart();
    setSubmitting(false);
    fetchProducts();
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {/* สรุปยอดรวมตัวใหญ่ไว้บนสุด ให้ผู้ขายและลูกค้าเห็นง่าย */}
      <div className="total-banner">
        <div className="total-label">ยอดรวมทั้งหมด</div>
        <div className="total-amount">{grandTotal.toFixed(2)} บาท</div>
        <div className="total-sub">{cart.length} รายการสินค้า</div>
      </div>

      {errorMsg && <p className="error-text">{errorMsg}</p>}
      {successMsg && <p style={{ color: '#16a34a' }}>{successMsg}</p>}

      {/* ฟอร์มเพิ่มสินค้าเข้าตะกร้า */}
      <div className="card">
        <h2>เพิ่มสินค้า</h2>
        {loading ? (
          <p>กำลังโหลดข้อมูลสินค้า...</p>
        ) : (
          <form onSubmit={handleAddToCart}>
            <div className="form-row">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.price} บาท/{p.unit}) - คงเหลือ {p.stock}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="จำนวน"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />

              <button type="submit">+ เพิ่มลงตะกร้า</button>
            </div>
          </form>
        )}
      </div>

      {/* ตะกร้าสินค้าที่กำลังจะขาย */}
      <div className="card">
        <h2>ตะกร้าสินค้า</h2>
        {cart.length === 0 ? (
          <p>ยังไม่มีสินค้าในตะกร้า</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>ราคา/หน่วย</th>
                <th>จำนวน</th>
                <th>รวม</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr key={item.productId}>
                  <td>{item.name}</td>
                  <td>{item.price} บาท/{item.unit}</td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleCartQtyChange(item.productId, e.target.value)
                      }
                      className="cart-qty-input"
                    />
                  </td>
                  <td>{(item.price * item.quantity).toFixed(2)} บาท</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.productId)}
                      className="btn-danger"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {cart.length > 0 && (
          <div className="checkout-row">
            <button
              type="button"
              onClick={handleCheckout}
              disabled={submitting}
              className="btn-checkout"
            >
              {submitting ? 'กำลังบันทึก...' : `ยืนยันการขาย (${grandTotal.toFixed(2)} บาท)`}
            </button>
            <button type="button" onClick={resetCart} disabled={submitting}>
              ล้างตะกร้า
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
