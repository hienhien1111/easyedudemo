'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import styles from './page.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

interface ClassInfo {
  id: string;
  name: string;
  isActive: boolean;
  teacher: { id: string; fullName: string; email: string };
  center: { id: string; name: string };
}

interface ScheduleTemplate {
  id: string;
  classId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  room: string | null;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  class: ClassInfo;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'MON', label: 'Thứ 2', short: 'T2' },
  { key: 'TUE', label: 'Thứ 3', short: 'T3' },
  { key: 'WED', label: 'Thứ 4', short: 'T4' },
  { key: 'THU', label: 'Thứ 5', short: 'T5' },
  { key: 'FRI', label: 'Thứ 6', short: 'T6' },
  { key: 'SAT', label: 'Thứ 7', short: 'T7' },
  { key: 'SUN', label: 'Chủ nhật', short: 'CN' },
];

const TIME_SLOTS = [
  { start: '07:00', end: '09:00', label: '7 – 9h' },
  { start: '09:00', end: '11:00', label: '9 – 11h' },
  { start: '13:00', end: '15:00', label: '13 – 15h' },
  { start: '15:00', end: '17:00', label: '15 – 17h' },
  { start: '19:00', end: '21:00', label: '19 – 21h' },
];

// Color palette cycling by class id
const CLASS_COLORS = [
  'color0', 'color1', 'color2', 'color3', 'color4', 'color5', 'color6', 'color7',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'Thứ 2', TUE: 'Thứ 3', WED: 'Thứ 4', THU: 'Thứ 5',
  FRI: 'Thứ 6', SAT: 'Thứ 7', SUN: 'Chủ nhật',
};

// Get today's DayOfWeek key
function getTodayKey(): DayOfWeek | null {
  const d = new Date().getDay(); // 0 = Sun, 1 = Mon, ...
  const map: Record<number, DayOfWeek> = {
    1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT', 0: 'SUN',
  };
  return map[d] ?? null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SchedulePage() {
  const router = useRouter();
  const [currentUser] = useState(() => getUser());

  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal
  type ModalMode = 'add' | 'edit' | 'delete' | null;
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScheduleTemplate | null>(null);
  const [ctxDay, setCtxDay] = useState<DayOfWeek>('MON');
  const [ctxSlot, setCtxSlot] = useState(TIME_SLOTS[0]);
  const [form, setForm] = useState({
    classId: '',
    dayOfWeek: 'MON' as DayOfWeek,
    startTime: '07:00',
    endTime: '09:00',
    room: '',
    isActive: true,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Filter
  const [showInactive, setShowInactive] = useState(false);

  const todayKey = getTodayKey();

  // ─── Auth guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser) {
      router.replace('/login');
    }
  }, []);

  // ─── Fetch data ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/schedule');
      setTemplates(res.data.data ?? res.data);

      // Only admin needs class list for the create form
      if (currentUser?.role === 'ADMIN') {
        const clsRes = await api.get('/classes');
        setAllClasses(
          (clsRes.data.data ?? clsRes.data).map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          })),
        );
      }
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  }

  // Build a color map: classId → color class name
  const colorMap = (() => {
    const ids = Array.from(new Set(templates.map((t) => t.classId)));
    const map: Record<string, string> = {};
    ids.forEach((id, i) => {
      map[id] = CLASS_COLORS[i % CLASS_COLORS.length];
    });
    return map;
  })();

  // ─── Grid lookup ─────────────────────────────────────────────────────────────

  function getCell(day: DayOfWeek, startTime: string): ScheduleTemplate[] {
    return templates.filter(
      (t) => t.dayOfWeek === day && t.startTime === startTime && (showInactive || t.isActive),
    );
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────────

  function openAdd(day: DayOfWeek, slot: (typeof TIME_SLOTS)[number]) {
    setCtxDay(day);
    setCtxSlot(slot);
    setForm({
      classId: '',
      dayOfWeek: day,
      startTime: slot.start,
      endTime: slot.end,
      room: '',
      isActive: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
    });
    setFormErrors({});
    setModalError('');
    setSelectedTemplate(null);
    setModalMode('add');
  }

  function openEdit(t: ScheduleTemplate) {
    setSelectedTemplate(t);
    setForm({
      classId: t.classId,
      dayOfWeek: t.dayOfWeek,
      startTime: t.startTime,
      endTime: t.endTime,
      room: t.room ?? '',
      isActive: t.isActive,
      effectiveFrom: t.effectiveFrom.split('T')[0],
      effectiveTo: t.effectiveTo ? t.effectiveTo.split('T')[0] : '',
    });
    setFormErrors({});
    setModalError('');
    setModalMode('edit');
  }

  function openDelete(t: ScheduleTemplate) {
    setSelectedTemplate(t);
    setModalError('');
    setModalMode('delete');
  }

  function closeModal() {
    setModalMode(null);
    setSelectedTemplate(null);
    setModalError('');
  }

  // ─── Validate ─────────────────────────────────────────────────────────────────

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.classId) errs.classId = 'Vui lòng chọn lớp học';
    if (!form.effectiveFrom) errs.effectiveFrom = 'Ngày hiệu lực là bắt buộc';
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
      await api.post('/schedule', {
        classId: form.classId,
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room || undefined,
        isActive: form.isActive,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
      });
      closeModal();
      await fetchData();
      showSuccess('Thêm lịch học thành công!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Thêm lịch học thất bại.';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Submit update ────────────────────────────────────────────────────────────

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSubmitting(true);
    setModalError('');
    try {
      await api.patch(`/schedule/${selectedTemplate.id}`, {
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        room: form.room || undefined,
        isActive: form.isActive,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || undefined,
      });
      closeModal();
      await fetchData();
      showSuccess('Cập nhật lịch học thành công!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Cập nhật thất bại.';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Submit delete ────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!selectedTemplate) return;
    setSubmitting(true);
    setModalError('');
    try {
      await api.delete(`/schedule/${selectedTemplate.id}`);
      closeModal();
      await fetchData();
      showSuccess('Xóa lịch học thành công!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Xóa thất bại.';
      setModalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Slot change → auto-fill endTime ─────────────────────────────────────────

  function handleSlotChange(start: string) {
    const slot = TIME_SLOTS.find((s) => s.start === start);
    if (slot) {
      setForm((f) => ({ ...f, startTime: slot.start, endTime: slot.end }));
    }
  }

  // ─── Unique class list for legend ────────────────────────────────────────────

  const uniqueClasses = (() => {
    const seen = new Set<string>();
    return templates
      .filter((t) => t.isActive)
      .filter((t) => {
        if (seen.has(t.classId)) return false;
        seen.add(t.classId);
        return true;
      })
      .map((t) => ({ id: t.classId, name: t.class.name }));
  })();

  // ─── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
        <p className="text-muted">Đang tải thời khoá biểu...</p>
      </div>
    );
  }

  const isAdmin = currentUser?.role === 'ADMIN';

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Thời khoá biểu</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            {isAdmin
              ? 'Quản lý lịch học theo tuần cho tất cả lớp'
              : currentUser?.role === 'TEACHER'
              ? 'Lịch dạy của bạn theo tuần'
              : 'Lịch học của bạn theo tuần'}
          </p>
        </div>
        {isAdmin && (
          <div className={styles.headerActions}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              Hiện lịch đã tắt
            </label>
          </div>
        )}
      </div>

      {/* ─── Alerts ──────────────────────────────────────────────── */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ─── Legend ──────────────────────────────────────────────── */}
      {uniqueClasses.length > 0 && (
        <div className={styles.legend}>
          {uniqueClasses.map((cls) => (
            <div key={cls.id} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{
                  background: getDotColor(colorMap[cls.id]),
                }}
              />
              <span className={styles.legendLabel}>{cls.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Weekly Grid ─────────────────────────────────────────── */}
      <div className={styles.gridWrapper}>
        <div className={styles.grid}>
          {/* Header row */}
          <div className={styles.gridHeaderCell} />
          {DAYS.map((d) => (
            <div
              key={d.key}
              className={`${styles.gridHeaderCell} ${d.key === todayKey ? styles.gridHeaderToday : ''}`}
            >
              {d.label}
            </div>
          ))}

          {/* Rows — one per time slot */}
          {TIME_SLOTS.map((slot) => (
            <>
              {/* Time label */}
              <div key={`label-${slot.start}`} className={styles.timeLabel}>
                {slot.label}
              </div>

              {/* 7 day cells */}
              {DAYS.map((d) => {
                const cells = getCell(d.key, slot.start);
                return (
                  <div
                    key={`${d.key}-${slot.start}`}
                    className={`${styles.cell} ${d.key === todayKey ? styles.cellToday : ''}`}
                  >
                    {cells.map((t) => (
                      <div
                        key={t.id}
                        className={`${styles.sessionCard} ${styles[colorMap[t.classId] as keyof typeof styles]} ${isAdmin ? styles.sessionCardAdmin : ''}`}
                        onClick={() => isAdmin && openEdit(t)}
                        title={isAdmin ? 'Nhấn để chỉnh sửa' : t.class.name}
                        style={{ opacity: t.isActive ? 1 : 0.5 }}
                      >
                        <div className={styles.sessionClassName}>{t.class.name}</div>
                        <div className={styles.sessionMeta}>
                          GV: {t.class.teacher.fullName}
                        </div>
                        <div className={styles.sessionMeta}>
                          {t.class.center.name}
                        </div>
                        {t.room && (
                          <div className={styles.sessionRoom}>🚪 {t.room}</div>
                        )}
                        {!t.isActive && (
                          <div style={{ fontSize: '0.68rem', marginTop: 2, fontWeight: 600, opacity: 0.7 }}>
                            [Đã tắt]
                          </div>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openDelete(t); }}
                            title="Xóa lịch"
                            style={{
                              position: 'absolute', top: 4, right: 4,
                              background: 'none', border: 'none', cursor: 'pointer',
                              opacity: 0, fontSize: '0.75rem', color: 'inherit',
                              padding: '2px 4px', borderRadius: 4,
                              transition: 'opacity 0.15s',
                            }}
                            className="delete-session-btn"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Add button — admin only */}
                    {isAdmin && (
                      <button
                        type="button"
                        className={styles.addBtn}
                        onClick={() => openAdd(d.key, slot)}
                      >
                        <span>＋</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* ─── Empty state ─────────────────────────────────────────── */}
      {templates.length === 0 && !loading && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📅</div>
          <p>
            {isAdmin
              ? 'Chưa có lịch học nào. Nhấn nút ＋ trong ô để thêm buổi học.'
              : 'Chưa có lịch học nào được sắp xếp cho bạn.'}
          </p>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ─── Add / Edit Modal ─────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────── */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <div className={styles.overlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {modalMode === 'add' ? 'Thêm buổi học vào lịch' : 'Chỉnh sửa lịch học'}
              </span>
              <button
                id="btn-close-schedule-modal"
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
              >
                ✕
              </button>
            </div>

            <form onSubmit={modalMode === 'add' ? handleCreate : handleUpdate}>
              <div className={styles.modalBody}>
                {modalError && (
                  <div className="alert alert-error">{modalError}</div>
                )}

                {/* Context badge */}
                <div className={styles.ctxBadge}>
                  📅{' '}
                  {modalMode === 'add'
                    ? `${DAY_LABELS[ctxDay]} · ${ctxSlot.label}`
                    : `${selectedTemplate ? DAY_LABELS[selectedTemplate.dayOfWeek] : ''} · ${selectedTemplate?.startTime} – ${selectedTemplate?.endTime}`}
                </div>

                <div className={styles.formGrid}>
                  {/* Lớp học — only show for add mode (edit keeps the class) */}
                  {modalMode === 'add' && (
                    <div className={`form-group ${styles.formGridFull}`}>
                      <label className="form-label" htmlFor="field-class">
                        Lớp học <span style={{ color: 'var(--color-error)' }}>*</span>
                      </label>
                      <select
                        id="field-class"
                        className={`${styles.formSelect} ${formErrors.classId ? 'error' : ''}`}
                        value={form.classId}
                        onChange={(e) => setForm({ ...form, classId: e.target.value })}
                      >
                        <option value="">-- Chọn lớp học --</option>
                        {allClasses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      {formErrors.classId && (
                        <span className="form-error">{formErrors.classId}</span>
                      )}
                    </div>
                  )}

                  {/* Nếu là edit, hiển thị tên lớp (read-only) */}
                  {modalMode === 'edit' && selectedTemplate && (
                    <div className={`form-group ${styles.formGridFull}`}>
                      <label className="form-label">Lớp học</label>
                      <div
                        style={{
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: '1.5px solid var(--color-border)',
                          background: 'var(--color-bg)',
                          fontSize: '0.875rem',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        {selectedTemplate.class.name}
                      </div>
                    </div>
                  )}

                  {/* Ngày trong tuần — edit mode only (add is fixed by context) */}
                  {modalMode === 'edit' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="field-dow">
                        Ngày trong tuần
                      </label>
                      <select
                        id="field-dow"
                        className={styles.formSelect}
                        value={form.dayOfWeek}
                        onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value as DayOfWeek })}
                      >
                        {DAYS.map((d) => (
                          <option key={d.key} value={d.key}>{d.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Khung giờ — edit mode only */}
                  {modalMode === 'edit' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="field-slot">
                        Khung giờ
                      </label>
                      <select
                        id="field-slot"
                        className={styles.formSelect}
                        value={form.startTime}
                        onChange={(e) => handleSlotChange(e.target.value)}
                      >
                        {TIME_SLOTS.map((s) => (
                          <option key={s.start} value={s.start}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Phòng học */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-room">
                      Phòng học
                    </label>
                    <input
                      id="field-room"
                      className="form-input"
                      type="text"
                      placeholder="VD: Phòng A1"
                      value={form.room}
                      onChange={(e) => setForm({ ...form, room: e.target.value })}
                    />
                  </div>

                  {/* Trạng thái */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-active">
                      Trạng thái
                    </label>
                    <select
                      id="field-active"
                      className={styles.formSelect}
                      value={form.isActive ? 'true' : 'false'}
                      onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                    >
                      <option value="true">Đang hoạt động</option>
                      <option value="false">Vô hiệu hoá</option>
                    </select>
                  </div>

                  {/* Hiệu lực từ */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-from">
                      Hiệu lực từ <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <input
                      id="field-from"
                      className={`form-input ${formErrors.effectiveFrom ? 'error' : ''}`}
                      type="date"
                      value={form.effectiveFrom}
                      onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                    />
                    {formErrors.effectiveFrom && (
                      <span className="form-error">{formErrors.effectiveFrom}</span>
                    )}
                  </div>

                  {/* Hiệu lực đến */}
                  <div className="form-group">
                    <label className="form-label" htmlFor="field-to">
                      Hiệu lực đến
                    </label>
                    <input
                      id="field-to"
                      className="form-input"
                      type="date"
                      value={form.effectiveTo}
                      onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  id="btn-schedule-cancel"
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  id="btn-schedule-submit"
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang lưu...' : modalMode === 'add' ? 'Thêm lịch học' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ─────────────────────────────────── */}
      {modalMode === 'delete' && selectedTemplate && (
        <div className={styles.overlay} onClick={closeModal}>
          <div
            className={styles.modal}
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Xác nhận xóa lịch học</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeModal}>✕</button>
            </div>

            <div className={styles.deleteBody}>
              {modalError && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>{modalError}</div>
              )}
              <div className={styles.deleteWarning}>
                <span className={styles.deleteIcon}>⚠️</span>
                <div>
                  <p className={styles.deleteText}>
                    Thao tác này sẽ xóa vĩnh viễn buổi lịch học này khỏi thời khóa biểu.
                  </p>
                  <p className={styles.deleteTarget}>
                    Lớp: <strong>{selectedTemplate.class.name}</strong> —{' '}
                    <strong>{DAY_LABELS[selectedTemplate.dayOfWeek]}</strong> · {selectedTemplate.startTime} – {selectedTemplate.endTime}
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={submitting}>
                Hủy bỏ
              </button>
              <button
                id="btn-confirm-delete-schedule"
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={submitting}
              >
                {submitting ? 'Đang xóa...' : 'Xóa lịch học'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hover CSS trick to show delete button */}
      <style>{`
        .${styles.sessionCard}:hover .delete-session-btn { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

// ─── Helper: get solid dot color from CSS class name ─────────────────────────
function getDotColor(colorClass: string): string {
  const map: Record<string, string> = {
    color0: '#6366f1', color1: '#10b981', color2: '#f59e0b', color3: '#ef4444',
    color4: '#3b82f6', color5: '#a855f7', color6: '#ec4899', color7: '#14b8a6',
  };
  return map[colorClass] ?? '#6366f1';
}
