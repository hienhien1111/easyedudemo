'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import styles from './page.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  phone?: string;
  isActive: boolean;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
  commissionRate?: string | null;
  createdAt: string;
  _count: { enrollments: number; taughtClasses: number };
}

interface FormData {
  email: string;
  fullName: string;
  password: string;
  newPassword: string;
  role: Role;
  phone: string;
  isActive: boolean;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  commissionRate: string;
}

const EMPTY_FORM: FormData = {
  email: '',
  fullName: '',
  password: '',
  newPassword: '',
  role: 'STUDENT',
  phone: '',
  isActive: true,
  bankName: '',
  bankAccountNo: '',
  bankAccountName: '',
  commissionRate: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

const roleLabelMap: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  TEACHER: 'Giáo viên',
  STUDENT: 'Học sinh',
};

const roleBadgeMap: Record<Role, string> = {
  ADMIN: 'badge badge-admin',
  TEACHER: 'badge badge-teacher',
  STUDENT: 'badge badge-student',
};

// ─── Icons ────────────────────────────────────────────────────────────────────
function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="7" y1="1" x2="7" y2="13" /><line x1="1" y1="7" x2="13" y2="7" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 1.5l2 2-7 7H2.5v-2l7-7z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1,3 12,3" /><path d="M4 3V2h5v1" /><path d="M2 3l1 9h7l1-9" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="2" x2="14" y2="14" /><line x1="14" y1="2" x2="2" y2="14" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const router = useRouter();
  const currentUser = getUser();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm state
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (currentUser?.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    fetchUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = filterRole === 'ALL' ? users : users.filter((u) => u.role === filterRole);
  const counts: Record<string, number> = {
    ALL: users.length,
    ADMIN: users.filter((u) => u.role === 'ADMIN').length,
    TEACHER: users.filter((u) => u.role === 'TEACHER').length,
    STUDENT: users.filter((u) => u.role === 'STUDENT').length,
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError('');
    setModalMode('create');
    setEditingUser(null);
  }

  function openEdit(user: User) {
    setForm({
      email: user.email,
      fullName: user.fullName,
      password: '',
      newPassword: '',
      role: user.role,
      phone: user.phone ?? '',
      isActive: user.isActive,
      bankName: user.bankName ?? '',
      bankAccountNo: user.bankAccountNo ?? '',
      bankAccountName: user.bankAccountName ?? '',
      commissionRate: user.commissionRate ?? '',
    });
    setFormError('');
    setEditingUser(user);
    setModalMode('edit');
  }

  function closeModal() {
    setModalMode(null);
    setEditingUser(null);
    setFormError('');
  }

  function handleField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (modalMode === 'create') {
        const payload: Record<string, unknown> = {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          role: form.role,
          isActive: form.isActive,
        };
        if (form.phone) payload.phone = form.phone;
        if (form.role === 'TEACHER') {
          if (form.bankName) payload.bankName = form.bankName;
          if (form.bankAccountNo) payload.bankAccountNo = form.bankAccountNo;
          if (form.bankAccountName) payload.bankAccountName = form.bankAccountName;
          if (form.commissionRate) payload.commissionRate = form.commissionRate;
        }
        const res = await api.post('/users', payload);
        setUsers((prev) => [res.data.data, ...prev]);
      } else if (modalMode === 'edit' && editingUser) {
        const payload: Record<string, unknown> = {};
        if (form.email !== editingUser.email) payload.email = form.email;
        if (form.fullName !== editingUser.fullName) payload.fullName = form.fullName;
        if (form.role !== editingUser.role) payload.role = form.role;
        if (form.phone !== (editingUser.phone ?? '')) payload.phone = form.phone || null;
        if (form.isActive !== editingUser.isActive) payload.isActive = form.isActive;
        if (form.newPassword) payload.newPassword = form.newPassword;
        if (form.bankName !== (editingUser.bankName ?? '')) payload.bankName = form.bankName || null;
        if (form.bankAccountNo !== (editingUser.bankAccountNo ?? '')) payload.bankAccountNo = form.bankAccountNo || null;
        if (form.bankAccountName !== (editingUser.bankAccountName ?? '')) payload.bankAccountName = form.bankAccountName || null;
        if (form.commissionRate !== (editingUser.commissionRate ?? '')) payload.commissionRate = form.commissionRate || null;
        const res = await api.patch(`/users/${editingUser.id}`, payload);
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? res.data.data : u)));
      }
      closeModal();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setFormError(Array.isArray(msg) ? msg[0] : (msg ?? 'Có lỗi xảy ra'));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  function openDelete(user: User) { setDeletingUser(user); setDeleteError(''); }
  function closeDelete() { setDeletingUser(null); setDeleteError(''); }

  async function handleDelete() {
    if (!deletingUser) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/users/${deletingUser.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deletingUser.id));
      closeDelete();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDeleteError(msg ?? 'Không thể xóa tài khoản');
    } finally {
      setDeleting(false);
    }
  }

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
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Quản lý người dùng</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>Danh sách tất cả tài khoản trong hệ thống</p>
        </div>
        <button id="btn-create-user" type="button" className="btn btn-primary" onClick={openCreate}>
          <IconPlus /> Tạo tài khoản
        </button>
      </div>

      {/* ─── Filter Chips ─────────────────────────────────────────────────── */}
      <div className={styles.statsRow}>
        {(['ALL', 'ADMIN', 'TEACHER', 'STUDENT'] as const).map((role) => (
          <button
            key={role}
            id={`filter-${role.toLowerCase()}`}
            type="button"
            className={`${styles.statChip} ${filterRole === role ? styles.statChipActive : ''}`}
            onClick={() => setFilterRole(role)}
          >
            <span className={styles.statChipCount}>{counts[role]}</span>
            <span className={styles.statChipLabel}>{role === 'ALL' ? 'Tất cả' : roleLabelMap[role]}</span>
          </button>
        ))}
      </div>

      {/* ─── Table ────────────────────────────────────────────────────────── */}
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
              <th style={{ textAlign: 'center' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                  Không có người dùng nào
                </td>
              </tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className={styles.userCell}>
                      <div
                        className={styles.userCellAvatar}
                        style={{
                          background: user.role === 'ADMIN' ? '#dbeafe' : user.role === 'TEACHER' ? '#dcfce7' : '#fef9c3',
                          color: user.role === 'ADMIN' ? '#1d4ed8' : user.role === 'TEACHER' ? '#166534' : '#854d0e',
                        }}
                      >
                        {user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{user.fullName}</span>
                    </div>
                  </td>
                  <td className="text-muted">{user.email}</td>
                  <td><span className={roleBadgeMap[user.role]}>{roleLabelMap[user.role]}</span></td>
                  <td>{user._count.taughtClasses > 0 ? user._count.taughtClasses : '—'}</td>
                  <td>{user._count.enrollments > 0 ? user._count.enrollments : '—'}</td>
                  <td>
                    <span className="badge" style={{ background: user.isActive ? '#f0fdf4' : '#fef2f2', color: user.isActive ? '#166534' : '#991b1b' }}>
                      {user.isActive ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </td>
                  <td className="text-muted">{formatDate(user.createdAt)}</td>
                  <td>
                    <div className={styles.actionCell}>
                      <button id={`btn-edit-${user.id}`} type="button" className={`${styles.actionBtn} ${styles.actionBtnEdit}`} onClick={() => openEdit(user)} title="Sửa tài khoản">
                        <IconEdit />
                      </button>
                      <button
                        id={`btn-delete-${user.id}`}
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                        onClick={() => openDelete(user)}
                        disabled={user.id === currentUser?.id}
                        title={user.id === currentUser?.id ? 'Không thể xóa tài khoản của mình' : 'Xóa tài khoản'}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Create / Edit Modal ──────────────────────────────────────────── */}
      {modalMode && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className={styles.modalHeader}>
              <h2 id="modal-title" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {modalMode === 'create' ? 'Tạo tài khoản mới' : 'Chỉnh sửa tài khoản'}
              </h2>
              <button type="button" className={styles.modalClose} onClick={closeModal} aria-label="Đóng"><IconClose /></button>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.modalBody}>
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="field-fullName">Họ và tên *</label>
                    <input id="field-fullName" type="text" className="form-input" placeholder="Nguyễn Văn A" value={form.fullName} onChange={(e) => handleField('fullName', e.target.value)} required autoFocus />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="field-phone">Số điện thoại</label>
                    <input id="field-phone" type="tel" className="form-input" placeholder="0912345678" value={form.phone} onChange={(e) => handleField('phone', e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="field-email">Email *</label>
                  <input id="field-email" type="email" className="form-input" placeholder="example@email.com" value={form.email} onChange={(e) => handleField('email', e.target.value)} required />
                </div>

                {modalMode === 'create' ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-password">Mật khẩu *</label>
                    <input id="field-password" type="password" className="form-input" placeholder="Tối thiểu 6 ký tự" value={form.password} onChange={(e) => handleField('password', e.target.value)} required minLength={6} />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-newPassword">
                      Mật khẩu mới <span className="text-muted" style={{ fontWeight: 400 }}>(để trống nếu không đổi)</span>
                    </label>
                    <input id="field-newPassword" type="password" className="form-input" placeholder="Tối thiểu 6 ký tự" value={form.newPassword} onChange={(e) => handleField('newPassword', e.target.value)} />
                  </div>
                )}

                <div className={styles.formRow}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="field-role">Vai trò *</label>
                    <select id="field-role" className="form-input" value={form.role} onChange={(e) => handleField('role', e.target.value as Role)}>
                      <option value="STUDENT">Học sinh</option>
                      <option value="TEACHER">Giáo viên</option>
                      <option value="ADMIN">Quản trị viên</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label" htmlFor="field-status">Trạng thái</label>
                    <select id="field-status" className="form-input" value={form.isActive ? 'active' : 'inactive'} onChange={(e) => handleField('isActive', e.target.value === 'active')}>
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Vô hiệu hóa</option>
                    </select>
                  </div>
                </div>

                {form.role === 'TEACHER' && (
                  <div className={styles.teacherSection}>
                    <p className={styles.sectionTitle}>Thông tin giáo viên</p>
                    <div className={styles.formRow}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" htmlFor="field-bankName">Ngân hàng</label>
                        <input id="field-bankName" type="text" className="form-input" placeholder="VD: Vietcombank" value={form.bankName} onChange={(e) => handleField('bankName', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" htmlFor="field-commissionRate">Tỉ lệ hoa hồng</label>
                        <input id="field-commissionRate" type="text" className="form-input" placeholder="VD: 0.3000 (30%)" value={form.commissionRate} onChange={(e) => handleField('commissionRate', e.target.value)} />
                      </div>
                    </div>
                    <div className={styles.formRow}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" htmlFor="field-bankAccountNo">Số tài khoản</label>
                        <input id="field-bankAccountNo" type="text" className="form-input" placeholder="1234567890" value={form.bankAccountNo} onChange={(e) => handleField('bankAccountNo', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label" htmlFor="field-bankAccountName">Tên chủ tài khoản</label>
                        <input id="field-bankAccountName" type="text" className="form-input" placeholder="NGUYEN VAN A" value={form.bankAccountName} onChange={(e) => handleField('bankAccountName', e.target.value)} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Hủy</button>
                <button id="btn-save-user" type="submit" className="btn btn-primary" disabled={saving}>
                  {saving
                    ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</>
                    : modalMode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ───────────────────────────────────────────────── */}
      {deletingUser && (
        <div className={styles.overlay} onClick={closeDelete}>
          <div className={`${styles.modal} ${styles.modalSm}`} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
            <div className={styles.modalHeader}>
              <h2 id="delete-title" style={{ fontSize: '1.1rem', fontWeight: 600 }}>Xác nhận xóa tài khoản</h2>
              <button type="button" className={styles.modalClose} onClick={closeDelete} aria-label="Đóng"><IconClose /></button>
            </div>
            <div className={styles.modalBody}>
              {deleteError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{deleteError}</div>}
              <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Bạn có chắc chắn muốn xóa tài khoản{' '}
                <strong style={{ color: 'var(--color-text-primary)' }}>{deletingUser.fullName}</strong>?
                <br />
                <span style={{ fontSize: '0.857rem', color: 'var(--color-text-muted)' }}>Hành động này không thể hoàn tác.</span>
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={closeDelete} disabled={deleting}>Hủy</button>
              <button id="btn-confirm-delete" type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting
                  ? <><div className="spinner" style={{ width: 14, height: 14, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} /> Đang xóa...</>
                  : 'Xóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
