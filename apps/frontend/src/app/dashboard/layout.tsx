'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearAuth, getAccessToken } from '@/lib/auth';
import api from '@/lib/api';
import styles from './layout.module.css';

const NAV_ITEMS = {
  ADMIN: [
    { href: '/dashboard', label: 'Tổng quan' },
    { href: '/dashboard/users', label: 'Người dùng' },
    { href: '/dashboard/classes', label: 'Lớp học' },
    { href: '/dashboard/schedule', label: 'Thời khoá biểu' },
    { href: '/dashboard/attendance', label: 'Điểm danh' },
  ],
  TEACHER: [
    { href: '/dashboard', label: 'Tổng quan' },
    { href: '/dashboard/classes', label: 'Lớp học' },
    { href: '/dashboard/schedule', label: 'Thời khoá biểu' },
    { href: '/dashboard/attendance', label: 'Điểm danh' },
  ],
  STUDENT: [
    { href: '/dashboard', label: 'Tổng quan' },
    { href: '/dashboard/schedule', label: 'Thời khoá biểu' },
  ],
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(getUser());
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
    }
  }, [router]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors, clear anyway
    } finally {
      clearAuth();
      router.push('/login');
    }
  }

  const navItems = user ? NAV_ITEMS[user.role] || [] : [];

  const roleLabel = {
    ADMIN: 'Quản trị viên',
    TEACHER: 'Giáo viên',
    STUDENT: 'Học sinh',
  };

  const roleBadgeClass = {
    ADMIN: 'badge badge-admin',
    TEACHER: 'badge badge-teacher',
    STUDENT: 'badge badge-student',
  };

  if (!user) return null;

  return (
    <div className={styles.shell}>
      {/* ─── Sidebar ────────────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoMark} />
            <span className={styles.logoText}>EE Demo</span>
          </div>
        </div>

        <nav className={styles.nav}>
          <p className={styles.navSection}>Điều hướng</p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
            >
              <span className={styles.navDot} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className={styles.userAvatar}>
              {user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <p className={styles.userName}>{user.fullName}</p>
              <span className={roleBadgeClass[user.role]}>
                {roleLabel[user.role]}
              </span>
            </div>
          </div>
          <button
            id="logout-btn"
            type="button"
            className={`btn btn-ghost btn-sm ${styles.logoutBtn}`}
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* ─── Main content ────────────────────────────────────────── */}
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.headerGreeting}>
              Xin chào, <strong>{user.fullName}</strong>
            </p>
          </div>
          <div className={styles.headerRight}>
            <span className={`badge ${roleBadgeClass[user.role].split(' ')[1]}`}>
              {roleLabel[user.role]}
            </span>
          </div>
        </header>

        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
