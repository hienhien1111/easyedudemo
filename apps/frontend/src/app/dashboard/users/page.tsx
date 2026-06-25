'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import styles from './page.module.css';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  isActive: boolean;
  createdAt: string;
  _count: { enrollments: number; taughtClasses: number };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

const roleLabelMap: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học sinh',
};

const roleBadgeMap: Record<string, string> = {
  ADMIN: 'badge badge-admin',
  TEACHER: 'badge badge-teacher',
  STUDENT: 'badge badge-student',
};

export default function UsersPage() {
  const router = useRouter();
  const currentUser = getUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch {
      setError('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }

  const filtered = filterRole === 'ALL' ? users : users.filter((u) => u.role === filterRole);

  const counts = {
    ALL: users.length,
    ADMIN: users.filter((u) => u.role === 'ADMIN').length,
    TEACHER: users.filter((u) => u.role === 'TEACHER').length,
    STUDENT: users.filter((u) => u.role === 'STUDENT').length,
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, flexDirection: 'column' }}>
        <div className="spinner" />
        <p className="text-muted">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Quản lý người dùng</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Danh sách tất cả tài khoản trong hệ thống
          </p>
        </div>
      </div>

      {/* ─── Stats ─────────────────────────────────────────────────── */}
      <div className={styles.statsRow}>
        {([['ALL', 'Tất cả'], ['ADMIN', 'Admin'], ['TEACHER', 'Giáo viên'], ['STUDENT', 'Học sinh']] as const).map(
          ([role, label]) => (
            <button
              key={role}
              id={`filter-${role.toLowerCase()}`}
              type="button"
              className={`${styles.statChip} ${filterRole === role ? styles.statChipActive : ''}`}
              onClick={() => setFilterRole(role)}
            >
              <span className={styles.statChipCount}>{counts[role]}</span>
              <span className={styles.statChipLabel}>{label}</span>
            </button>
          )
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ─── Table ─────────────────────────────────────────────────── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Lớp phụ trách</th>
              <th>Lớp đăng ký</th>
              <th>Trạng thái</th>
              <th>Ngày tạo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                  Không có người dùng nào
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.userCellAvatar}>
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{user.fullName}</span>
                    </div>
                  </td>
                  <td className="text-muted">{user.email}</td>
                  <td>
                    <span className={roleBadgeMap[user.role]}>
                      {roleLabelMap[user.role]}
                    </span>
                  </td>
                  <td>{user._count.taughtClasses > 0 ? user._count.taughtClasses : '—'}</td>
                  <td>{user._count.enrollments > 0 ? user._count.enrollments : '—'}</td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: user.isActive ? '#f0fdf4' : '#fef2f2',
                        color: user.isActive ? '#166534' : '#991b1b',
                      }}
                    >
                      {user.isActive ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </td>
                  <td className="text-muted">{formatDate(user.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
