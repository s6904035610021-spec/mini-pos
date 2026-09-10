'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function SellPage() {
  // รายการสินค้าทั้งหมด (สำหรับ dropdown)
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // สินค้าที่เลือกขาย และจำนวน
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');

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

  // หาข้อมูลสินค้าที่เลือกอยู่ปัจจุบัน
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  // คำนวณยอดรวม (ราคา x จำนวน) อัตโนมัติ
  const qtyNumber = parseInt(quantity, 10) || 0;
  const totalPrice = selectedProduct ? selectedProduct.price * qtyNumber : 0;

  const resetForm = () => {
    setSelectedProductId('');
    setQuantity('');
  };

  // กดปุ่ม "ขาย"
  const handleSell = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!selectedProduct) {
      setErrorMsg('กรุณาเลือกสินค้า');
      return;
    }
    if (qtyNumber <= 0) {
      setErrorMsg('กรุณากรอกจำนวนให้ถูกต้อง');
      return;
    }
    // ตรวจสอบว่า stock เพียงพอหรือไม่
    if (qtyNumber > selectedProduct.stock) {
      setErrorMsg(
        `สินค้าคงเหลือไม่เพียงพอ (คงเหลือ ${selectedProduct.stock} ${selectedProduct.unit})`
      );
      return;
    }

    setSubmitting(true);

    // 1) บันทึกรายการขายลงตาราง sales
    const { error: saleError } = await supabase.from('sales').insert([
      {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qtyNumber,
        total_price: totalPrice,
        sold_at: new Date().toISOString(),
      },
    ]);

    if (saleError) {
      setErrorMsg(saleError.message);
      setSubmitting(false);
      return;
    }

    // 2) อัปเดต stock ในตาราง products ให้ลดลงตามจำนวนที่ขาย
    const newStock = selectedProduct.stock - qtyNumber;
    const { error: stockError } = await supabase
      .from('products')
      .update({ stock: newStock })
      .eq('id', selectedProduct.id);

    if (stockError) {
      setErrorMsg(stockError.message);
      setSubmitting(false);
      return;
    }

    // สำเร็จ: แจ้งเตือนและรีเซ็ตฟอร์ม
    setSuccessMsg(
      `ขาย ${selectedProduct.name} จำนวน ${qtyNumber} ${selectedProduct.unit} สำเร็จ (รวม ${totalPrice.toFixed(2)} บาท)`
    );
    resetForm();
    setSubmitting(false);
    fetchProducts(); // โหลดสินค้าใหม่เพื่ออัปเดต stock ที่แสดงผล
  };

  return (
    <div>
      <h1>ขายสินค้า</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}
      {successMsg && <p style={{ color: '#16a34a' }}>{successMsg}</p>}

      {loading ? (
        <p>กำลังโหลดข้อมูลสินค้า...</p>
      ) : (
        <div className="card">
          <form onSubmit={handleSell}>
            <div className="form-row">
              {/* Dropdown เลือกสินค้า แสดงชื่อและราคา */}
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

              {/* ช่องกรอกจำนวน */}
              <input
                type="number"
                placeholder="จำนวน"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />

              <button type="submit" disabled={submitting}>
                {submitting ? 'กำลังบันทึก...' : 'ขาย'}
              </button>
            </div>
          </form>

          {/* แสดงยอดรวมอัตโนมัติ ก่อนกดยืนยัน */}
          {selectedProduct && (
            <p>
              ยอดรวม: <strong>{totalPrice.toFixed(2)} บาท</strong>
              {' '}({selectedProduct.price} x {qtyNumber || 0})
            </p>
          )}
        </div>
      )}
    </div>
  );
}
