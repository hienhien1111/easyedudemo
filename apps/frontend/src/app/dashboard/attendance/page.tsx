'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import styles from './page.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type AttendanceStatus = 'PRESENT' | 'ABSENT_EXCUSED' | 'ABSENT_UNEXCUSED';
type TimeStatus = 'upcoming' | 'active' | 'ended';
type SessionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface ClassInfo {
  id: string;
  name: string;
  isActive: boolean;
  teacher: { id: string; fullName: string };
  center: { id: string; name: string };
  _count: { enrollments: number };
}

interface Template {
  id: string;
  classId: string;
  startTime: string;
  endTime: string;
  room: string | null;
  class: ClassInfo;
}

interface TodaySession {
  template: Template;
  session: { id: string; status: SessionStatus; _count: { attendanceRecords: number } } | null;
  timeStatus: TimeStatus;
  date: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: AttendanceStatus;
  notes: string | null;
  markedAt: string;
  student: { id: string; fullName: string; email: string; phone?: string };
  marker: { id: string; fullName: string };
}

interface SessionDetail {
  id: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string | null;
  status: SessionStatus;
  class: {
    id: string;
    name: string;
    teacher: { id: string; fullName: string };
    center: { id: string; name: string };
  };
  attendanceRecords: AttendanceRecord[];
}

interface Student {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimeHM(time: string) {
  return time.slice(0, 5); // "07:00" → "07:00"
}

function formatDateVN(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getCountdown(startTime: string): string {
  const now = new Date();
  const [h, m] = startTime.split(':').map(Number);
  const target = new Date();
  target.setHours(h, m, 0, 0);
  const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 60000));
  if (diff <= 0) return 'Đang diễn ra';
  if (diff < 60) return `Còn ${diff} phút`;
  return `Còn ${Math.floor(diff / 60)}h${diff % 60 > 0 ? diff % 60 + 'm' : ''}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const router = useRouter();
  const [currentUser] = useState(() => getUser());

  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Active attendance view
  const [activeSession, setActiveSession] = useState<SessionDetail | null>(null);
  const [unmarkedStudents, setUnmarkedStudents] = useState<Student[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  // Countdown refresh
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Auth guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUser || currentUser.role === 'STUDENT') {
      router.replace('/dashboard');
    }
  }, []);

  // ─── Tick every 30s to refresh countdown ────────────────────────────────────

  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 30000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // ─── Fetch today sessions ────────────────────────────────────────────────────

  const fetchToday = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/attendance/today');
      setTodaySessions(res.data.data ?? res.data);
    } catch {
      setError('Không thể tải danh sách buổi học hôm nay.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  // ─── Flash success ───────────────────────────────────────────────────────────

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  // ─── Open attendance view ────────────────────────────────────────────────────

  async function openAttendance(item: TodaySession) {
    setLoadingSession(true);
    setActiveSession(null);
    setUnmarkedStudents([]);
    try {
      // Step 1: get-or-create session
      const sessionRes = await api.post('/attendance/sessions', {
        classId: item.template.classId,
        templateId: item.template.id,
        date: item.date,
        startTime: item.template.startTime,
        endTime: item.template.endTime,
        room: item.template.room ?? undefined,
      });
      const sessionData = sessionRes.data.data ?? sessionRes.data;
      const sessionId: string = sessionData.id;

      // Step 2: get full session detail
      const detailRes = await api.get(`/attendance/sessions/${sessionId}`);
      const detail = detailRes.data.data ?? detailRes.data;
      setActiveSession(detail.session);
      setUnmarkedStudents(detail.unmarkedStudents ?? []);

      // Refresh today list
      await fetchToday();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi mở điểm danh.';
      setError(typeof msg === 'string' ? msg : 'Lỗi mở điểm danh.');
    } finally {
      setLoadingSession(false);
    }
  }

  // ─── Refresh session detail ──────────────────────────────────────────────────

  async function refreshSession(sessionId: string) {
    const detailRes = await api.get(`/attendance/sessions/${sessionId}`);
    const detail = detailRes.data.data ?? detailRes.data;
    setActiveSession(detail.session);
    setUnmarkedStudents(detail.unmarkedStudents ?? []);
  }

  // ─── Mark single student ─────────────────────────────────────────────────────

  async function markStudent(studentId: string, status: AttendanceStatus) {
    if (!activeSession) return;
    setSavingStudentId(studentId);
    try {
      await api.post(`/attendance/sessions/${activeSession.id}/mark`, { studentId, status });
      await refreshSession(activeSession.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi điểm danh.';
      setError(typeof msg === 'string' ? msg : 'Lỗi điểm danh.');
    } finally {
      setSavingStudentId(null);
    }
  }

  // ─── Bulk mark all unmarked ──────────────────────────────────────────────────

  async function bulkMarkUnmarked(status: AttendanceStatus) {
    if (!activeSession || unmarkedStudents.length === 0) return;
    setSavingStudentId('bulk');
    try {
      const records = unmarkedStudents.map((s) => ({ studentId: s.id, status }));
      await api.post(`/attendance/sessions/${activeSession.id}/bulk-mark`, { records });
      await refreshSession(activeSession.id);
      showSuccess('Đã điểm danh tất cả học viên chưa điểm!');
    } catch {
      setError('Lỗi khi điểm danh hàng loạt.');
    } finally {
      setSavingStudentId(null);
    }
  }

  // ─── Complete session ────────────────────────────────────────────────────────

  async function completeSession() {
    if (!activeSession) return;
    setCompleting(true);
    try {
      await api.patch(`/attendance/sessions/${activeSession.id}/complete`);
      setActiveSession((prev) => prev ? { ...prev, status: 'COMPLETED' } : null);
      await fetchToday();
      showSuccess('Buổi học đã được kết thúc!');
    } catch {
      setError('Lỗi khi kết thúc buổi học.');
    } finally {
      setCompleting(false);
    }
  }

  // ─── Computed values ─────────────────────────────────────────────────────────

  function getStatusForStudent(studentId: string): AttendanceStatus | null {
    if (!activeSession) return null;
    return activeSession.attendanceRecords.find((r) => r.studentId === studentId)?.status ?? null;
  }

  const allStudents: Student[] = activeSession
    ? [
        ...activeSession.attendanceRecords.map((r) => r.student),
        ...unmarkedStudents,
      ]
    : [];

  const presentCount = activeSession?.attendanceRecords.filter((r) => r.status === 'PRESENT').length ?? 0;
  const excusedCount = activeSession?.attendanceRecords.filter((r) => r.status === 'ABSENT_EXCUSED').length ?? 0;
  const unexcusedCount = activeSession?.attendanceRecords.filter((r) => r.status === 'ABSENT_UNEXCUSED').length ?? 0;
  const totalStudents = allStudents.length;
  const isCompleted = activeSession?.status === 'COMPLETED';

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className="spinner" />
        <p className="text-muted">Đang tải danh sách buổi học hôm nay...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1>Điểm danh</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Điểm danh realtime theo lịch học hôm nay
          </p>
        </div>
        <div className={styles.dateBadge}>
          📅 {formatDateVN(new Date().toISOString())}
        </div>
      </div>

      {/* ─── Alerts ──────────────────────────────────────────────── */}
      {error && <div className="alert alert-error" onClick={() => setError('')} style={{ cursor: 'pointer' }}>{error} ✕</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ─── TODAY SESSIONS ──────────────────────────────────────── */}
      <div>
        <p className={styles.sectionTitle}>Buổi học hôm nay ({todaySessions.length} buổi)</p>

        {todaySessions.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📭</div>
            <p>Không có buổi học nào theo lịch hôm nay.</p>
          </div>
        ) : (
          <div className={styles.sessionsGrid}>
            {todaySessions.map((item) => {
              const isCurrentSession = activeSession?.classId === item.template.classId
                && activeSession.startTime === item.template.startTime;
              const sessionStatus = item.session?.status;

              return (
                <div
                  key={`${item.template.id}-${item.date}`}
                  className={`${styles.sessionCard} ${styles[`status${item.timeStatus.charAt(0).toUpperCase() + item.timeStatus.slice(1)}`]}`}
                  style={{ borderColor: isCurrentSession ? 'var(--color-primary)' : undefined }}
                >
                  <div className={styles.sessionCardHeader}>
                    <div>
                      <div className={styles.sessionClassName}>{item.template.class.name}</div>
                      <div className={styles.sessionCenter}>{item.template.class.center.name}</div>
                    </div>

                    {/* Session status */}
                    {sessionStatus === 'COMPLETED' ? (
                      <span className={`${styles.statusBadge} ${styles.completed}`}>✅ Hoàn thành</span>
                    ) : item.timeStatus === 'active' ? (
                      <span className={`${styles.statusBadge} ${styles.active}`}>
                        <span className={styles.pulseDot} /> Đang diễn ra
                      </span>
                    ) : item.timeStatus === 'upcoming' ? (
                      <span className={`${styles.statusBadge} ${styles.upcoming}`}>⏱ Sắp tới</span>
                    ) : (
                      <span className={`${styles.statusBadge} ${styles.ended}`}>Đã qua</span>
                    )}
                  </div>

                  {/* Time */}
                  <div className={styles.sessionTime}>
                    🕐 {formatTimeHM(item.template.startTime)}
                    <span className={styles.sessionTimeSep}>–</span>
                    {formatTimeHM(item.template.endTime)}
                    {item.template.room && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 4 }}>
                        🚪 {item.template.room}
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className={styles.sessionStats}>
                    <span className={styles.statChip}>
                      👥 {item.template.class._count.enrollments} học viên
                    </span>
                    {item.session && (
                      <span className={styles.statChip}>
                        ✅ {item.session._count.attendanceRecords} đã điểm
                      </span>
                    )}
                    {item.timeStatus === 'upcoming' && (
                      <span className={styles.countdown}>{getCountdown(item.template.startTime)}</span>
                    )}
                  </div>

                  {/* Action */}
                  {sessionStatus !== 'COMPLETED' && (
                    <button
                      type="button"
                      className={`btn ${isCurrentSession ? 'btn-outline' : 'btn-primary'} btn-sm`}
                      style={{ width: '100%' }}
                      disabled={loadingSession}
                      onClick={() => openAttendance(item)}
                    >
                      {loadingSession && isCurrentSession
                        ? 'Đang tải...'
                        : item.session
                        ? '📋 Tiếp tục điểm danh'
                        : '📋 Bắt đầu điểm danh'}
                    </button>
                  )}

                  {sessionStatus === 'COMPLETED' && isCurrentSession && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ width: '100%' }}
                      onClick={() => openAttendance(item)}
                    >
                      👁 Xem điểm danh
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── ATTENDANCE VIEW ─────────────────────────────────────── */}
      {activeSession && (
        <div>
          <p className={styles.sectionTitle}>
            Danh sách điểm danh — {activeSession.class.name}
          </p>

          <div className={styles.attendanceView}>
            {/* Header */}
            <div className={styles.attendanceHeader}>
              <div className={styles.attendanceTitle}>
                <div className={styles.attendanceClassName}>{activeSession.class.name}</div>
                <div className={styles.attendanceSubtitle}>
                  {formatTimeHM(activeSession.startTime)} – {formatTimeHM(activeSession.endTime)}
                  {activeSession.room ? ` · 🚪 ${activeSession.room}` : ''}
                  {' · '}{activeSession.class.center.name}
                </div>
              </div>

              <div className={styles.attendanceActions}>
                {!isCompleted && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={completing}
                    onClick={completeSession}
                  >
                    {completing ? 'Đang lưu...' : '✅ Kết thúc buổi học'}
                  </button>
                )}
                {isCompleted && (
                  <span className={`${styles.statusBadge} ${styles.completed}`} style={{ fontSize: '0.82rem', padding: '5px 14px' }}>
                    ✅ Buổi học đã kết thúc
                  </span>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveSession(null)}>
                  ✕ Đóng
                </button>
              </div>
            </div>

            {/* Summary bar */}
            <div className={styles.summaryBar}>
              <div className={styles.summaryItem}>
                <span className={`${styles.summaryDot} ${styles.present}`} />
                <span className={styles.summaryCount}>{presentCount}</span>
                <span className={styles.summaryLabel}>Có mặt</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={`${styles.summaryDot} ${styles['absent-excused']}`} />
                <span className={styles.summaryCount}>{excusedCount}</span>
                <span className={styles.summaryLabel}>Vắng có phép</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={`${styles.summaryDot} ${styles['absent-unexcused']}`} />
                <span className={styles.summaryCount}>{unexcusedCount}</span>
                <span className={styles.summaryLabel}>Vắng không phép</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={`${styles.summaryDot} ${styles.unmarked}`} />
                <span className={styles.summaryCount}>{unmarkedStudents.length}</span>
                <span className={styles.summaryLabel}>Chưa điểm</span>
              </div>
              <div className={styles.summaryItem} style={{ marginLeft: 'auto' }}>
                <span className={styles.summaryCount}>{totalStudents}</span>
                <span className={styles.summaryLabel}>tổng học viên</span>
              </div>
            </div>

            {/* Student list */}
            {allStudents.length === 0 ? (
              <div className={styles.emptyState} style={{ padding: 32 }}>
                <p>Lớp chưa có học viên nào được đăng ký.</p>
              </div>
            ) : (
              <div className={styles.studentList}>
                {allStudents.map((student, idx) => {
                  const currentStatus = getStatusForStudent(student.id);
                  const isSaving = savingStudentId === student.id || savingStudentId === 'bulk';

                  return (
                    <div
                      key={student.id}
                      className={`${styles.studentRow} ${isSaving ? styles.rowSaving : ''}`}
                    >
                      <div className={styles.studentAvatar}>
                        {student.fullName.charAt(0).toUpperCase()}
                      </div>

                      <div className={styles.studentInfo}>
                        <div className={styles.studentName}>
                          <span style={{ color: 'var(--color-text-muted)', marginRight: 6, fontSize: '0.75rem' }}>
                            #{idx + 1}
                          </span>
                          {student.fullName}
                        </div>
                        <div className={styles.studentEmail}>{student.email}</div>
                      </div>

                      {/* Toggle buttons */}
                      {!isCompleted ? (
                        <div className={styles.toggleGroup}>
                          <button
                            type="button"
                            className={`${styles.toggleBtn} ${currentStatus === 'PRESENT' ? styles['present-active'] : styles['present-idle']}`}
                            onClick={() => markStudent(student.id, 'PRESENT')}
                            disabled={isSaving}
                            title="Có mặt"
                          >
                            ✓ Có mặt
                          </button>
                          <button
                            type="button"
                            className={`${styles.toggleBtn} ${currentStatus === 'ABSENT_EXCUSED' ? styles['excused-active'] : styles['excused-idle']}`}
                            onClick={() => markStudent(student.id, 'ABSENT_EXCUSED')}
                            disabled={isSaving}
                            title="Vắng có phép"
                          >
                            📋 Có phép
                          </button>
                          <button
                            type="button"
                            className={`${styles.toggleBtn} ${currentStatus === 'ABSENT_UNEXCUSED' ? styles['unexcused-active'] : styles['unexcused-idle']}`}
                            onClick={() => markStudent(student.id, 'ABSENT_UNEXCUSED')}
                            disabled={isSaving}
                            title="Vắng không phép"
                          >
                            ✗ Không phép
                          </button>
                        </div>
                      ) : (
                        /* Read-only display when session completed */
                        <div>
                          {currentStatus === 'PRESENT' && (
                            <span className={`${styles.toggleBtn} ${styles['present-active']}`}>✓ Có mặt</span>
                          )}
                          {currentStatus === 'ABSENT_EXCUSED' && (
                            <span className={`${styles.toggleBtn} ${styles['excused-active']}`}>📋 Có phép</span>
                          )}
                          {currentStatus === 'ABSENT_UNEXCUSED' && (
                            <span className={`${styles.toggleBtn} ${styles['unexcused-active']}`}>✗ Không phép</span>
                          )}
                          {!currentStatus && (
                            <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bulk action bar — only when not completed and there are unmarked students */}
            {!isCompleted && unmarkedStudents.length > 0 && (
              <div className={styles.bulkBar}>
                <span className={styles.bulkLabel}>
                  Điểm danh nhanh {unmarkedStudents.length} em chưa điểm:
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: 'rgba(16,185,129,0.15)', color: '#065f46', border: '1.5px solid #10b981' }}
                  disabled={savingStudentId === 'bulk'}
                  onClick={() => bulkMarkUnmarked('PRESENT')}
                >
                  ✓ Tất cả có mặt
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: 'rgba(239,68,68,0.13)', color: '#991b1b', border: '1.5px solid #ef4444' }}
                  disabled={savingStudentId === 'bulk'}
                  onClick={() => bulkMarkUnmarked('ABSENT_UNEXCUSED')}
                >
                  ✗ Tất cả vắng không phép
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
