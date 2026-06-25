'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import styles from './page.module.css';

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT';
  isActive: boolean;
  createdAt: string;
  taughtClasses?: Array<{
    id: string;
    name: string;
    center: { name: string };
    startDate: string | null;
    endDate: string | null;
    _count: { enrollments: number };
  }>;
  enrollments?: Array<{
    id: string;
    enrolledAt: string;
    status: string;
    class: {
      id: string;
      name: string;
      center: { name: string };
      teacher: { fullName: string };
      startDate: string | null;
      endDate: string | null;
    };
  }>;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function roleLabel(role: string) {
  const map: Record<string, string> = {
    ADMIN: 'Quản trị viên',
    TEACHER: 'Giáo viên',
    STUDENT: 'Học sinh',
  };
  return map[role] || role;
}

function roleBadgeClass(role: string) {
  const map: Record<string, string> = {
    ADMIN: 'badge badge-admin',
    TEACHER: 'badge badge-teacher',
    STUDENT: 'badge badge-student',
  };
  return map[role] || 'badge';
}

export default function DashboardPage() {
  const localUser = getUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await api.get('/users/me');
        setProfile(res.data.data);
      } catch {
        setError('Không thể tải thông tin người dùng');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
        <p>Đang tải...</p>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!profile) return null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Tổng quan</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Thông tin tài khoản và hoạt động của bạn
          </p>
        </div>
      </div>

      {/* ─── Profile card ─────────────────────────────────────────── */}
      <div className={styles.profileCard}>
        <div className={styles.profileAvatar}>
          {profile.fullName.charAt(0).toUpperCase()}
        </div>
        <div className={styles.profileInfo}>
          <div className={styles.profileName}>
            {profile.fullName}
            <span className={roleBadgeClass(profile.role)} style={{ marginLeft: 10 }}>
              {roleLabel(profile.role)}
            </span>
          </div>
          <p className={styles.profileEmail}>{profile.email}</p>
          <p className={styles.profileMeta}>
            Tham gia từ {formatDate(profile.createdAt)}
            <span className={`badge ${profile.isActive ? 'badge-teacher' : ''}`}
              style={{ marginLeft: 12, background: profile.isActive ? undefined : '#fef2f2', color: profile.isActive ? undefined : '#991b1b' }}>
              {profile.isActive ? 'Hoạt động' : 'Đã vô hiệu'}
            </span>
          </p>
        </div>
      </div>

      {/* ─── Teacher: Lớp đang dạy ────────────────────────────────── */}
      {profile.role === 'TEACHER' && profile.taughtClasses && (
        <div className={styles.section}>
          <h2>Lớp học đang phụ trách</h2>
          {profile.taughtClasses.length === 0 ? (
            <div className={styles.emptyState}>Chưa có lớp học nào được phân công.</div>
          ) : (
            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Tên lớp</th>
                    <th>Trung tâm</th>
                    <th>Ngày bắt đầu</th>
                    <th>Ngày kết thúc</th>
                    <th>Số học viên</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.taughtClasses.map((cls) => (
                    <tr key={cls.id}>
                      <td style={{ fontWeight: 500 }}>{cls.name}</td>
                      <td>{cls.center.name}</td>
                      <td>{formatDate(cls.startDate)}</td>
                      <td>{formatDate(cls.endDate)}</td>
                      <td>
                        <span className="badge badge-student">{cls._count.enrollments} học viên</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Student: Lớp đã đăng ký ──────────────────────────────── */}
      {profile.role === 'STUDENT' && profile.enrollments && (
        <div className={styles.section}>
          <h2>Lớp học đã đăng ký</h2>
          {profile.enrollments.length === 0 ? (
            <div className={styles.emptyState}>Bạn chưa đăng ký lớp học nào.</div>
          ) : (
            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>Tên lớp</th>
                    <th>Trung tâm</th>
                    <th>Giáo viên</th>
                    <th>Ngày bắt đầu</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.enrollments.map((en) => (
                    <tr key={en.id}>
                      <td style={{ fontWeight: 500 }}>{en.class.name}</td>
                      <td>{en.class.center.name}</td>
                      <td>{en.class.teacher.fullName}</td>
                      <td>{formatDate(en.class.startDate)}</td>
                      <td>
                        <span className="badge badge-teacher">{en.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Admin: Info box ──────────────────────────────────────── */}
      {profile.role === 'ADMIN' && (
        <div className={styles.section}>
          <div className={styles.adminInfo}>
            <h3>Quyền Admin</h3>
            <p>
              Bạn có toàn quyền quản lý hệ thống. Truy cập mục{' '}
              <strong>Người dùng</strong> để xem và quản lý tất cả tài khoản.
            </p>
          </div>
        </div>
      )}

      {/* ─── Account Info ─────────────────────────────────────────── */}
      <div className={styles.section}>
        <h2>Thông tin tài khoản</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>ID</span>
            <span className={styles.infoValue} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{profile.id}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Email</span>
            <span className={styles.infoValue}>{profile.email}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Họ tên</span>
            <span className={styles.infoValue}>{profile.fullName}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Vai trò</span>
            <span className={roleBadgeClass(profile.role)}>{roleLabel(profile.role)}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Ngày tạo</span>
            <span className={styles.infoValue}>{formatDate(profile.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
