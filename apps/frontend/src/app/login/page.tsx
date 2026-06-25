'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuth, AuthUser } from '@/lib/auth';
import styles from './login.module.css';

interface LoginResponse {
  success: boolean;
  data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password });
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(accessToken, refreshToken, user);
      router.push('/dashboard');
    } catch (err: any) {
      const messages = err?.response?.data?.message;
      if (Array.isArray(messages)) {
        setError(messages[0]);
      } else {
        setError('Email hoặc mật khẩu không đúng');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function fillDemo(role: 'admin' | 'teacher' | 'student') {
    const accounts = {
      admin:   { email: 'admin@eedemo.com',   password: 'Admin@123' },
      teacher: { email: 'teacher@eedemo.com', password: 'Teacher@123' },
      student: { email: 'student@eedemo.com', password: 'Student@123' },
    };
    setEmail(accounts[role].email);
    setPassword(accounts[role].password);
    setError('');
  }

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <div className={styles.brandMark} />
          <span className={styles.brandName}>EE Demo</span>
        </div>
        <div className={styles.tagline}>
          <h1>Hệ thống quản lý<br />Trung tâm Dạy học</h1>
          <p>Quản lý lớp học, giáo viên và học sinh một cách hiệu quả.</p>
        </div>
        <div className={styles.features}>
          <div className={styles.featureItem}>
            <div className={styles.featureDot} />
            <span>Quản lý đa chi nhánh</span>
          </div>
          <div className={styles.featureItem}>
            <div className={styles.featureDot} />
            <span>Phân quyền Admin / Giáo viên / Học sinh</span>
          </div>
          <div className={styles.featureItem}>
            <div className={styles.featureDot} />
            <span>Bảo mật JWT với token tự động làm mới</span>
          </div>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.formCard}>
          <div className={styles.formHeader}>
            <h2>Đăng nhập</h2>
            <p>Nhập thông tin tài khoản của bạn</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} id="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className={`form-input ${error ? 'error' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Mật khẩu</label>
              <input
                id="password"
                type="password"
                className={`form-input ${error ? 'error' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={isLoading}
            >
              {isLoading ? <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> : null}
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="divider" style={{ margin: '20px 0' }} />

          <div className={styles.demoSection}>
            <p className={styles.demoLabel}>Tài khoản demo:</p>
            <div className={styles.demoButtons}>
              <button
                id="demo-admin"
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fillDemo('admin')}
              >
                Admin
              </button>
              <button
                id="demo-teacher"
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fillDemo('teacher')}
              >
                Giáo viên
              </button>
              <button
                id="demo-student"
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fillDemo('student')}
              >
                Học sinh
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
