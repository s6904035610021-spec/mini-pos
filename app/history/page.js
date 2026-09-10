'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function HistoryPage() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // โหลดประวัติการขายทั้งหมด เรียงจากล่าสุดไปเก่าสุด
  const fetchSales = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('sold_at', { ascending: false });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSales(data);
      setErrorMsg('');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSales();
  }, []);

  // คำนวณยอดขายรวมทั้งหมด (sum ของ total_price)
  const totalRevenue = sales.reduce(
    (sum, sale) => sum + Number(sale.total_price || 0),
    0
  );

  // แปลงวันเวลาให้อ่านง่าย
  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  return (
    <div>
      <h1>ประวัติการขาย</h1>

      {errorMsg && <p className="error-text">{errorMsg}</p>}

      {/* ยอดขายรวมทั้งหมด */}
      <div className="card">
        <h2>ยอดขายรวมทั้งหมด: {totalRevenue.toFixed(2)} บาท</h2>
        <p>จำนวนรายการขายทั้งหมด: {sales.length} รายการ</p>
      </div>

      {loading ? (
        <p>กำลังโหลดข้อมูล...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>วันเวลาที่ขาย</th>
              <th>ชื่อสินค้า</th>
              <th>จำนวน</th>
              <th>ยอดรวม</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td>{formatDateTime(sale.sold_at)}</td>
                <td>{sale.product_name}</td>
                <td>{sale.quantity}</td>
                <td>{Number(sale.total_price).toFixed(2)} บาท</td>
              </tr>
            ))}
            {sales.length === 0 && (
              <tr>
                <td colSpan="4">ยังไม่มีประวัติการขาย</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
