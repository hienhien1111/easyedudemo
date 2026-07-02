'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import styles from './page.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Center {
  id: string;
  name: string;
  address?: string;
}

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  _count: { taughtClasses: number };
}

interface ClassItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  pricePerSession: string;
  createdAt: string;
  center: { id: string; name: string; address?: string };
  teacher: { id: string; fullName: string; email: string; phone?: string };
  _count: { enrollments: number; sessions: number };
}

type ModalMode = 'create' | 'edit' | 'delete' | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function formatPrice(price: string | number) {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

// ─── Default form state ───────────────────────────────────────────────────────

const defaultForm = {
  name: '',
  description: '',
  centerId: '',
  teacherId: '',
  isActive: true,
  startDate: '',
  endDate: '',
  pricePerSession: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ClassesPage() {
  const router = useRouter();
  const currentUser = getUser();

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // ─── Auth guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'TEACHER')) {
      router.replace('/dashboard');
    }
  }, []);

  // ─── Fetch data ─────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (currentUser?.role === 'ADMIN') {
        const [classRes, teacherRes, centerRes] = await Promise.all([
          api.get('/classes'),
          api.get('/classes/teachers'),
          api.get('/classes/centers'),
        ]);
        setClasses(classRes.data.data);
        setTeachers(teacherRes.data.data);
        setCenters(centerRes.data.data);
      } else {
        const classRes = await api.get('/classes');
        setClasses(classRes.data.data);
      }
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Flash success ───────────────────────────────────────────────────────────

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  }

  // ─── Open modals ─────────────────────────────────────────────────────────────

  function openCreate() {
    setForm(defaultForm);
    setFormErrors({});
    setModalError('');
    setSelectedClass(null);
    setModalMode('create');
  }

  function openEdit(cls: ClassItem) {
    setForm({
      name: cls.name,
      description: cls.description ?? '',
      centerId: cls.center.id,
      teacherId: cls.teacher.id,
      isActive: cls.isActive,
      startDate: cls.startDate ? cls.startDate.split('T')[0] : '',
      endDate: cls.endDate ? cls.endDate.split('T')[0] : '',
      pricePerSession: cls.pricePerSession.toString(),
    });
    setFormErrors({});
    setModalError('');
    setSelectedClass(cls);
    setModalMode('edit');
  }

  function openDelete(cls: ClassItem) {
    setSelectedClass(cls);
    setModalError('');
    setModalMode('delete');
  }

  function closeModal() {
    setModalMode(null);
    setSelectedClass(null);
    setModalError('');
  }

  // ─── Validate form ───────────────────────────────────────────────────────────

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Tên lớp là bắt buộc';
    if (!form.centerId) errs.centerId = 'Vui lòng chọn trung tâm';
    if (!form.teacherId) errs.teacherId = 'Vui lòng chọn giáo viên';
    if (form.startDate && form.endDate && form.startDate >= form.endDate) {
      errs.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    if (form.pricePerSession && isNaN(Number(form.pricePerSession))) {
      errs.pricePerSession = 'Học phí không hợp lệ';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ─── Submit create ────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setModalError('');
    try {
      await api.post('/classes', {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        centerId: form.centerId,
        teacherId: form.teacherId,
        isActive: form.isActive,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        pricePerSession: form.pricePerSession || undefined,
      });
      closeModal();
      await fetchAll();
      showSuccess('Tạo lớp học thành công!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Tạo lớp học thất bại. Vui lòng thử lại.';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Submit update ────────────────────────────────────────────────────────────

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !selectedClass) return;
    setSubmitting(true);
    setModalError('');
    try {
      await api.patch(`/classes/${selectedClass.id}`, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        centerId: form.centerId,
        teacherId: form.teacherId,
        isActive: form.isActive,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        pricePerSession: form.pricePerSession || undefined,
      });
      closeModal();
      await fetchAll();
      showSuccess('Cập nhật lớp học thành công!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Cập nhật thất bại. Vui lòng thử lại.';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Submit delete ────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!selectedClass) return;
    setSubmitting(true);
    setModalError('');
    try {
      await api.delete(`/classes/${selectedClass.id}`);
      closeModal();
      await fetchAll();
      showSuccess('Xóa lớp học thành công!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Xóa lớp học thất bại.';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Filter ───────────────────────────────────────────────────────────────────

  const filtered =
    filterStatus === 'ALL'
      ? classes
      : filterStatus === 'ACTIVE'
      ? classes.filter((c) => c.isActive)
      : classes.filter((c) => !c.isActive);

  const counts = {
    ALL: classes.length,
    ACTIVE: classes.filter((c) => c.isActive).length,
    INACTIVE: classes.filter((c) => !c.isActive).length,
  };

  // ─── Loading ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
        <p className="text-muted">Đang tải danh sách lớp học...</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Quản lý lớp học</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Tạo, chỉnh sửa và gán giáo viên cho từng lớp học
          </p>
        </div>
        {currentUser?.role === 'ADMIN' && (
          <button
            id="btn-create-class"
            type="button"
            className="btn btn-primary"
            onClick={openCreate}
          >
            + Tạo lớp học
          </button>
        )}
      </div>

      {/* ─── Alerts ──────────────────────────────────────────────── */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ─── Stats filter ────────────────────────────────────────── */}
      <div className={styles.statsRow}>
        {(
          [
            ['ALL', 'Tất cả'],
            ['ACTIVE', 'Đang hoạt động'],
            ['INACTIVE', 'Đã vô hiệu'],
          ] as const
        ).map(([status, label]) => (
          <button
            key={status}
            id={`filter-${status.toLowerCase()}`}
            type="button"
            className={`${styles.statChip} ${filterStatus === status ? styles.statChipActive : ''}`}
            onClick={() => setFilterStatus(status)}
          >
            <span className={styles.statChipCount}>{counts[status]}</span>
            <span className={styles.statChipLabel}>{label}</span>
          </button>
        ))}
      </div>

      {/* ─── Table ───────────────────────────────────────────────── */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tên lớp</th>
              <th>Trung tâm</th>
              <th>Giáo viên phụ trách</th>
              <th>Học phí/buổi</th>
              <th>Ngày bắt đầu</th>
              <th>Ngày kết thúc</th>
              <th>Học viên</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', padding: '48px', color: 'var(--color-text-muted)' }}
                >
                  Không có lớp học nào
                </td>
              </tr>
            ) : (
              filtered.map((cls) => (
                <tr key={cls.id}>
                  {/* Tên lớp */}
                  <td>
                    <div style={{ fontWeight: 600 }}>{cls.name}</div>
                    {cls.description && (
                      <div
                        style={{
                          fontSize: '0.786rem',
                          color: 'var(--color-text-muted)',
                          marginTop: 2,
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cls.description}
                      </div>
                    )}
                  </td>

                  {/* Trung tâm */}
                  <td className="text-muted">{cls.center.name}</td>

                  {/* Giáo viên */}
                  <td>
                    <div className={styles.teacherCell}>
                      <div className={styles.teacherAvatar}>
                        {cls.teacher.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className={styles.teacherName}>{cls.teacher.fullName}</div>
                        <div className={styles.teacherEmail}>{cls.teacher.email}</div>
                      </div>
                    </div>
                  </td>

                  {/* Học phí */}
                  <td>
                    <span className={styles.priceBadge}>{formatPrice(cls.pricePerSession)}</span>
                  </td>

                  {/* Ngày */}
                  <td className="text-muted">{formatDate(cls.startDate)}</td>
                  <td className="text-muted">{formatDate(cls.endDate)}</td>

                  {/* Học viên */}
                  <td>
                    <span className="badge badge-student">
                      {cls._count.enrollments} học viên
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: cls.isActive ? '#f0fdf4' : '#fef2f2',
                        color: cls.isActive ? '#166534' : '#991b1b',
                      }}
                    >
                      {cls.isActive ? 'Hoạt động' : 'Vô hiệu'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className={styles.actionsCell}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => router.push(`/dashboard/classes/${cls.id}/students`)}
                      >
                        Quản lý học viên
                      </button>
                      {currentUser?.role === 'ADMIN' && (
                        <>
                          <button
                            id={`btn-edit-${cls.id}`}
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => openEdit(cls)}
                          >
                            Sửa
                          </button>
                          <button
                            id={`btn-delete-${cls.id}`}
                            type="button"
                            className="btn btn-sm"
                            style={{
                              background: '#fef2f2',
                              color: '#991b1b',
                              border: '1px solid #fecaca',
                            }}
                            onClick={() => openDelete(cls)}
                          >
                            Xóa
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ─── Create / Edit Modal ──────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────── */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {modalMode === 'create' ? 'Tạo lớp học mới' : 'Chỉnh sửa lớp học'}
              </span>
              <button
                id="btn-close-modal"
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
              >
                ✕
              </button>
            </div>

            <form onSubmit={modalMode === 'create' ? handleCreate : handleUpdate}>
              <div className={styles.modalBody}>
                {modalError && (
                  <div className="alert alert-error">{modalError}</div>
                )}

                <div className={styles.formGrid}>
                  {/* Tên lớp */}
                  <div className={`form-group ${styles.formGridFull}`}>
                    <label className="form-label" htmlFor="field-name">
                      Tên lớp học <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <input
                      id="field-name"
                      className={`form-input ${formErrors.name ? 'error' : ''}`}
                      type="text"
                      placeholder="VD: Toán 10A1"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    {formErrors.name && (
                      <span className="form-error">{formErrors.name}</span>
                    )}
                  </div>

                  {/* Mô tả */}
                  <div className={`form-group ${styles.formGridFull}`}>
                    <label className="form-label" htmlFor="field-description">
                      Mô tả
                    </label>
                    <textarea
                      id="field-description"
                      className="form-input"
                      rows={2}
                      placeholder="Mô tả ngắn về lớp học..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  {/* Trung tâm */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-center">
                      Trung tâm <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <select
                      id="field-center"
                      className={`${styles.formSelect} ${formErrors.centerId ? 'error' : ''}`}
                      value={form.centerId}
                      onChange={(e) => setForm({ ...form, centerId: e.target.value })}
                    >
                      <option value="">-- Chọn trung tâm --</option>
                      {centers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.centerId && (
                      <span className="form-error">{formErrors.centerId}</span>
                    )}
                  </div>

                  {/* Giáo viên */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-teacher">
                      Giáo viên phụ trách <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <select
                      id="field-teacher"
                      className={`${styles.formSelect} ${formErrors.teacherId ? 'error' : ''}`}
                      value={form.teacherId}
                      onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                    >
                      <option value="">-- Chọn giáo viên --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName} ({t._count.taughtClasses} lớp)
                        </option>
                      ))}
                    </select>
                    {formErrors.teacherId && (
                      <span className="form-error">{formErrors.teacherId}</span>
                    )}
                  </div>

                  {/* Học phí */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-price">
                      Học phí / buổi (VNĐ)
                    </label>
                    <input
                      id="field-price"
                      className={`form-input ${formErrors.pricePerSession ? 'error' : ''}`}
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="VD: 150000"
                      value={form.pricePerSession}
                      onChange={(e) => setForm({ ...form, pricePerSession: e.target.value })}
                    />
                    {formErrors.pricePerSession && (
                      <span className="form-error">{formErrors.pricePerSession}</span>
                    )}
                  </div>

                  {/* Trạng thái */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-status">
                      Trạng thái
                    </label>
                    <select
                      id="field-status"
                      className={styles.formSelect}
                      value={form.isActive ? 'true' : 'false'}
                      onChange={(e) =>
                        setForm({ ...form, isActive: e.target.value === 'true' })
                      }
                    >
                      <option value="true">Đang hoạt động</option>
                      <option value="false">Vô hiệu hoá</option>
                    </select>
                  </div>

                  {/* Ngày bắt đầu */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-start">
                      Ngày bắt đầu
                    </label>
                    <input
                      id="field-start"
                      className="form-input"
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    />
                  </div>

                  {/* Ngày kết thúc */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-end">
                      Ngày kết thúc
                    </label>
                    <input
                      id="field-end"
                      className={`form-input ${formErrors.endDate ? 'error' : ''}`}
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    />
                    {formErrors.endDate && (
                      <span className="form-error">{formErrors.endDate}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  id="btn-modal-cancel"
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  id="btn-modal-submit"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Đang lưu...'
                    : modalMode === 'create'
                    ? 'Tạo lớp học'
                    : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ─── Delete Confirm Modal ─────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────── */}
      {modalMode === 'delete' && selectedClass && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={styles.modal}
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Xác nhận xóa lớp học</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
              >
                ✕
              </button>
            </div>

            <div className={styles.deleteBody}>
              {modalError && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  {modalError}
                </div>
              )}
              <div className={styles.deleteWarning}>
                <span className={styles.deleteIcon}>⚠️</span>
                <div>
                  <p className={styles.deleteText}>
                    Thao tác này không thể hoàn tác. Lớp học sẽ bị xóa vĩnh viễn khỏi hệ
                    thống.
                    {selectedClass._count.enrollments > 0 && (
                      <strong>
                        {' '}
                        Lớp này đang có {selectedClass._count.enrollments} học sinh — không thể
                        xóa, hãy vô hiệu hoá thay thế.
                      </strong>
                    )}
                  </p>
                  <p className={styles.deleteTarget}>
                    Lớp: <strong>{selectedClass.name}</strong> — GV:{' '}
                    <strong>{selectedClass.teacher.fullName}</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeModal}
                disabled={submitting}
              >
                Hủy bỏ
              </button>
              <button
                id="btn-confirm-delete"
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={submitting || selectedClass._count.enrollments > 0}
              >
                {submitting ? 'Đang xóa...' : 'Xóa lớp học'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
