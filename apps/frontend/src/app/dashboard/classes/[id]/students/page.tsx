'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import styles from './page.module.css';

interface ClassInfo {
  id: string;
  name: string;
  teacher: { id: string; fullName: string };
  _count: { enrollments: number };
}

interface Enrollment {
  id: string;
  enrolledAt: string;
  student: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
}

interface AvailableStudent {
  id: string;
  fullName: string;
  email: string;
}

export default function ClassStudentsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const currentUser = getUser();
  const classId = params.id;

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [clsRes, enrollRes] = await Promise.all([
        api.get(`/classes/${classId}`),
        api.get(`/classes/${classId}/students`),
      ]);
      setClassInfo(clsRes.data.data);
      setEnrollments(enrollRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải dữ liệu lớp học.');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'TEACHER')) {
      router.replace('/dashboard');
      return;
    }
    fetchData();
  }, [currentUser, router, fetchData]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  }

  async function openAddModal() {
    setModalError('');
    setSelectedStudentIds([]);
    setIsAddModalOpen(true);
    try {
      const res = await api.get('/users/students');
      const allStudents: AvailableStudent[] = res.data.data;
      // Filter out students already in class
      const enrolledIds = new Set(enrollments.map((e) => e.student.id));
      setAvailableStudents(allStudents.filter((s) => !enrolledIds.has(s.id)));
    } catch (err: any) {
      setModalError('Lỗi khi tải danh sách học viên');
    }
  }

  function closeAddModal() {
    setIsAddModalOpen(false);
    setModalError('');
  }

  function toggleSelect(id: string) {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleAddStudents(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStudentIds.length === 0) {
      setModalError('Vui lòng chọn ít nhất một học viên');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/classes/${classId}/students`, {
        studentIds: selectedStudentIds,
      });
      closeAddModal();
      showSuccess('Thêm học viên thành công');
      fetchData();
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Lỗi khi thêm học viên');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveStudent(studentId: string, studentName: string) {
    if (!confirm(`Bạn có chắc muốn xóa học viên ${studentName} khỏi lớp?`)) return;
    try {
      await api.delete(`/classes/${classId}/students/${studentId}`);
      showSuccess('Đã xóa học viên khỏi lớp');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Lỗi khi xóa học viên');
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!classInfo) {
    return (
      <div className={styles.page}>
        <div className="alert alert-error">{error || 'Không tìm thấy lớp học'}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/dashboard/classes" className={styles.backLink}>
        ← Quay lại danh sách lớp
      </Link>

      <div className={styles.pageHeader}>
        <div>
          <h1>Học viên lớp: {classInfo.name}</h1>
          <p className="text-muted" style={{ marginTop: 4 }}>
            Giáo viên phụ trách: {classInfo.teacher.fullName}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          + Thêm học viên
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Ngày tham gia</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px' }}>
                  Lớp chưa có học viên nào.
                </td>
              </tr>
            ) : (
              enrollments.map((en) => (
                <tr key={en.id}>
                  <td style={{ fontWeight: 500 }}>{en.student.fullName}</td>
                  <td className="text-muted">{en.student.email}</td>
                  <td className="text-muted">{en.student.phone || '—'}</td>
                  <td>{new Date(en.enrolledAt).toLocaleDateString('vi-VN')}</td>
                  <td>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ color: '#991b1b', borderColor: '#fecaca' }}
                      onClick={() => handleRemoveStudent(en.student.id, en.student.fullName)}
                    >
                      Xóa khỏi lớp
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className={styles.overlay} onClick={closeAddModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Thêm học viên vào lớp</span>
              <button className="btn btn-ghost btn-sm" onClick={closeAddModal}>
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddStudents}>
              <div className={styles.modalBody}>
                {modalError && <div className="alert alert-error">{modalError}</div>}
                
                {availableStudents.length === 0 ? (
                  <p className="text-muted" style={{ textAlign: 'center' }}>
                    Không có học viên nào khả dụng để thêm.
                  </p>
                ) : (
                  <div className={styles.studentList}>
                    {availableStudents.map((student) => (
                      <label key={student.id} className={styles.studentOption}>
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(student.id)}
                          onChange={() => toggleSelect(student.id)}
                        />
                        <div className={styles.studentInfo}>
                          <span className={styles.studentName}>{student.fullName}</span>
                          <span className={styles.studentEmail}>{student.email}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className="btn btn-ghost" onClick={closeAddModal} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || availableStudents.length === 0}>
                  {submitting ? 'Đang thêm...' : `Thêm ${selectedStudentIds.length} học viên`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
