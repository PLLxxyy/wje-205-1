import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { api, setToken, getToken } from './api';

// ============ Types ============
interface User {
  id: number;
  name: string;
  role: 'patient' | 'doctor' | 'admin';
  username?: string;
}

interface Department {
  id: number;
  name: string;
  description: string;
}

interface Doctor {
  id: number;
  name: string;
  title: string;
  bio: string;
  department_id?: number;
  department_name?: string;
}

interface TimeSlot {
  id: number;
  doctor_id: number;
  date: string;
  start_time: string;
  end_time: string;
  max_appointments: number;
  current_appointments: number;
}

interface Appointment {
  id: number;
  patient_id: number;
  doctor_id: number;
  slot_id: number;
  date: string;
  queue_number: number;
  status: string;
  diagnosis: string;
  created_at: string;
  doctor_name?: string;
  doctor_title?: string;
  department_name?: string;
  start_time?: string;
  end_time?: string;
  patient_name?: string;
  patient_phone?: string;
}

// ============ Auth Context ============
interface AuthCtx {
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({ user: null, login: () => {}, logout: () => {} });
function useAuth() { return useContext(AuthContext); }

// ============ Toast Context ============
type ToastType = { id: number; message: string; type: 'success' | 'error' | 'info' };
let toastId = 0;

interface ToastCtx {
  toasts: ToastType[];
  show: (message: string, type?: ToastType['type']) => void;
}

const ToastContext = createContext<ToastCtx>({ toasts: [], show: () => {} });
function useToast() { return useContext(ToastContext); }

function ToastContainer() {
  const { toasts } = useToast();
  return (
    <>
      {toasts.map((t, i) => (
        <div key={t.id} className={`toast toast-${t.type}`} style={{ top: 80 + i * 56 }}>
          {t.message}
        </div>
      ))}
    </>
  );
}

// ============ Router ============
type Route =
  | { page: 'home' }
  | { page: 'login' }
  | { page: 'department'; id: number }
  | { page: 'book'; doctorId: number; doctorName: string; deptName: string }
  | { page: 'my-appointments' }
  | { page: 'doctor' }
  | { page: 'queue-display'; departmentId: number }
  | { page: 'queue-overview' }
  | { page: 'admin' };

const RouterCtx = createContext<{ route: Route; navigate: (r: Route) => void }>({
  route: { page: 'home' },
  navigate: () => {},
});
function useRouter() { return useContext(RouterCtx); }

function parseHash(): Route {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0 || hash === '/') return { page: 'home' };
  if (parts[0] === 'login') return { page: 'login' };
  if (parts[0] === 'departments' && parts[1]) return { page: 'department', id: Number(parts[1]) };
  if (parts[0] === 'book' && parts[1]) return { page: 'book', doctorId: Number(parts[1]), doctorName: decodeURIComponent(parts[2] || ''), deptName: decodeURIComponent(parts[3] || '') };
  if (parts[0] === 'my-appointments') return { page: 'my-appointments' };
  if (parts[0] === 'doctor') return { page: 'doctor' };
  if (parts[0] === 'queue' && parts[1]) return { page: 'queue-display', departmentId: Number(parts[1]) };
  if (parts[0] === 'queue-overview') return { page: 'queue-overview' };
  if (parts[0] === 'admin') return { page: 'admin' };
  return { page: 'home' };
}

function routeToHash(r: Route): string {
  switch (r.page) {
    case 'home': return '/';
    case 'login': return '/login';
    case 'department': return `/departments/${r.id}`;
    case 'book': return `/book/${r.doctorId}/${encodeURIComponent(r.doctorName)}/${encodeURIComponent(r.deptName)}`;
    case 'my-appointments': return '/my-appointments';
    case 'doctor': return '/doctor';
    case 'queue-display': return `/queue/${r.departmentId}`;
    case 'queue-overview': return '/queue-overview';
    case 'admin': return '/admin';
  }
}

// ============ Header ============
function Header() {
  const { user, logout } = useAuth();
  const { navigate } = useRouter();

  return (
    <div className="header">
      <h1 style={{ cursor: 'pointer' }} onClick={() => navigate({ page: 'home' })}>排队预约挂号系统</h1>
      <div className="header-nav">
        {user ? (
          <>
            <span className="header-user">{user.name} ({user.role === 'patient' ? '患者' : user.role === 'doctor' ? '医生' : '管理员'})</span>
            {user.role === 'patient' && (
              <>
                <button onClick={() => navigate({ page: 'my-appointments' })}>我的预约</button>
                <button onClick={() => navigate({ page: 'queue-overview' })}>排队大屏</button>
              </>
            )}
            {user.role === 'doctor' && <button onClick={() => navigate({ page: 'doctor' })}>医生工作台</button>}
            {user.role === 'admin' && (
              <>
                <button onClick={() => navigate({ page: 'admin' })}>管理后台</button>
                <button onClick={() => navigate({ page: 'queue-overview' })}>排队大屏</button>
              </>
            )}
            <button onClick={() => { logout(); navigate({ page: 'home' }); }}>退出</button>
          </>
        ) : (
          <>
            <button onClick={() => navigate({ page: 'queue-overview' })}>排队大屏</button>
            <button onClick={() => navigate({ page: 'login' })}>登录</button>
          </>
        )}
      </div>
    </div>
  );
}

// ============ Login Page ============
function LoginPage() {
  const { login } = useAuth();
  const { navigate } = useRouter();
  const { show } = useToast();
  const [tab, setTab] = useState<'patient' | 'doctor' | 'admin'>('patient');
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', name: '', phone: '', id_card: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'patient' && isRegister) {
        const data = await api.registerPatient(form);
        login(data.token, data.user);
        show('注册成功！', 'success');
        navigate({ page: 'home' });
      } else if (tab === 'patient') {
        const data = await api.loginPatient(form);
        login(data.token, data.user);
        show('登录成功！', 'success');
        navigate({ page: 'home' });
      } else if (tab === 'doctor') {
        const data = await api.loginDoctor(form);
        login(data.token, data.user);
        show('登录成功！', 'success');
        navigate({ page: 'doctor' });
      } else {
        const data = await api.loginAdmin(form);
        login(data.token, data.user);
        show('登录成功！', 'success');
        navigate({ page: 'admin' });
      }
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card card">
      <h2 className="text-center mb-16">排队预约挂号系统</h2>
      <div className="login-tabs">
        <button className={`login-tab ${tab === 'patient' ? 'active' : ''}`} onClick={() => { setTab('patient'); setIsRegister(false); }}>患者</button>
        <button className={`login-tab ${tab === 'doctor' ? 'active' : ''}`} onClick={() => { setTab('doctor'); setIsRegister(false); }}>医生</button>
        <button className={`login-tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => { setTab('admin'); setIsRegister(false); }}>管理员</button>
      </div>
      <form onSubmit={handleSubmit}>
        {tab === 'patient' && isRegister && (
          <>
            <div className="form-group">
              <label className="form-label">姓名</label>
              <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">手机号</label>
              <input className="form-input" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </>
        )}
        <div className="form-group">
          <label className="form-label">用户名</label>
          <input className="form-input" required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">密码</label>
          <input className="form-input" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        </div>
        <button className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? '处理中...' : isRegister ? '注册' : '登录'}
        </button>
      </form>
      {tab === 'patient' && (
        <p className="text-center mt-16 text-sm">
          {isRegister ? '已有账号？' : '没有账号？'}
          <button className="link-btn" onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
      )}
      {tab === 'doctor' && (
        <p className="text-center mt-16 text-sm text-gray">测试账号: doc_wang / 123456</p>
      )}
      {tab === 'admin' && (
        <p className="text-center mt-16 text-sm text-gray">测试账号: admin / admin123</p>
      )}
      {tab === 'patient' && !isRegister && (
        <p className="text-center mt-8 text-sm text-gray">测试账号: patient_zhang / 123456</p>
      )}
    </div>
  );
}

// ============ Home Page ============
function HomePage() {
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  return (
    <div className="container">
      <div className="hero">
        <h2>在线预约挂号，告别排队等候</h2>
        <p>选择科室和医生，轻松预约就诊时段</p>
      </div>
      <div className="page-title">选择科室</div>
      <div className="grid grid-4">
        {departments.map(dept => (
          <div key={dept.id} className="dept-card" onClick={() => navigate({ page: 'department', id: dept.id })}>
            <h3>{dept.name}</h3>
            <p>{dept.description}</p>
          </div>
        ))}
      </div>
      {!user && (
        <div className="text-center mt-24">
          <p className="text-gray mb-8">登录后即可预约挂号</p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate({ page: 'login' })}>立即登录</button>
        </div>
      )}
    </div>
  );
}

// ============ Department Page ============
function DepartmentPage({ id }: { id: number }) {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { show } = useToast();
  const [dept, setDept] = useState<any>(null);

  useEffect(() => {
    api.getDepartment(id).then(setDept).catch(() => show('加载失败', 'error'));
  }, [id]);

  if (!dept) return <div className="container"><div className="loading"><div className="spinner" />加载中...</div></div>;

  return (
    <div className="container">
      <button className="back-link" onClick={() => navigate({ page: 'home' })}>← 返回科室列表</button>
      <div className="page-title">{dept.name}</div>
      <p className="text-gray mb-16">{dept.description}</p>
      <div className="grid grid-2">
        {(dept.doctors || []).map((doc: Doctor) => (
          <div key={doc.id} className="card">
            <div className="doctor-card">
              <div className="doctor-avatar">{doc.name[0]}</div>
              <div className="doctor-info">
                <div>
                  <span className="doctor-name">{doc.name}</span>
                  <span className="doctor-title">{doc.title}</span>
                </div>
                <div className="doctor-bio">{doc.bio}</div>
              </div>
            </div>
            <div className="mt-16" style={{ textAlign: 'right' }}>
              {user?.role === 'patient' ? (
                <button className="btn btn-primary" onClick={() => navigate({ page: 'book', doctorId: doc.id, doctorName: doc.name, deptName: dept.name })}>
                  预约挂号
                </button>
              ) : !user ? (
                <button className="btn btn-ghost" onClick={() => navigate({ page: 'login' })}>登录后预约</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {(!dept.doctors || dept.doctors.length === 0) && (
        <div className="empty-state"><p>该科室暂无医生</p></div>
      )}
    </div>
  );
}

// ============ Booking Page ============
function BookingPage({ doctorId, doctorName, deptName }: { doctorId: number; doctorName: string; deptName: string }) {
  const { navigate } = useRouter();
  const { show } = useToast();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [dates] = useState(() => {
    const d: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date();
      dt.setDate(dt.getDate() + i);
      d.push(dt.toISOString().slice(0, 10));
    }
    return d;
  });

  useEffect(() => {
    api.getSlots(doctorId, date).then(setSlots).catch(() => {});
    setSelectedSlot(null);
  }, [doctorId, date]);

  const book = async () => {
    if (!selectedSlot) { show('请选择时段', 'error'); return; }
    setLoading(true);
    try {
      const data = await api.bookAppointment({ doctor_id: doctorId, slot_id: selectedSlot });
      show(`预约成功！您的排队号为 ${data.queue_number}，就诊时间 ${data.time}`, 'success');
      navigate({ page: 'my-appointments' });
    } catch (err: any) {
      show(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const weekDay = (d: string) => {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[new Date(d + 'T00:00:00').getDay()];
  };

  return (
    <div className="container">
      <button className="back-link" onClick={() => navigate({ page: 'home' })}>← 返回</button>
      <div className="page-title">预约挂号</div>
      <div className="card mb-16">
        <div className="doctor-card">
          <div className="doctor-avatar">{doctorName[0]}</div>
          <div className="doctor-info">
            <div><span className="doctor-name">{doctorName}</span></div>
            <div className="doctor-bio">{deptName}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">选择日期</div>
        <div className="slots-grid mb-16">
          {dates.map(d => (
            <button key={d} className={`slot-btn ${d === date ? 'selected' : ''}`} onClick={() => setDate(d)}>
              {d.slice(5)} {weekDay(d)}
            </button>
          ))}
        </div>

        <div className="card-title">选择时段</div>
        {slots.length === 0 ? (
          <div className="empty-state"><p>该日期暂无可预约时段</p></div>
        ) : (
          <>
            <div className="text-sm text-gray mb-8">上午</div>
            <div className="slots-grid mb-16">
              {slots.filter(s => s.start_time < '12:00').map(slot => (
                <button key={slot.id} className={`slot-btn ${selectedSlot === slot.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSlot(slot.id)}>
                  {slot.start_time}-{slot.end_time}
                  <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>
                    余{slot.max_appointments - slot.current_appointments}
                  </span>
                </button>
              ))}
            </div>
            <div className="text-sm text-gray mb-8">下午</div>
            <div className="slots-grid mb-16">
              {slots.filter(s => s.start_time >= '12:00').map(slot => (
                <button key={slot.id} className={`slot-btn ${selectedSlot === slot.id ? 'selected' : ''}`}
                  onClick={() => setSelectedSlot(slot.id)}>
                  {slot.start_time}-{slot.end_time}
                  <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>
                    余{slot.max_appointments - slot.current_appointments}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="text-center mt-16">
          <button className="btn btn-primary btn-lg" onClick={book} disabled={!selectedSlot || loading}>
            {loading ? '预约中...' : '确认预约'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ My Appointments Page ============
function MyAppointmentsPage() {
  const { navigate } = useRouter();
  const { show } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getMyAppointments().then(setAppointments).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const cancel = async (id: number) => {
    if (!confirm('确定取消该预约？')) return;
    try {
      await api.cancelAppointment(id);
      show('取消成功', 'success');
      load();
    } catch (err: any) {
      show(err.message, 'error');
    }
  };

  const statusText: Record<string, string> = {
    waiting: '等待就诊', serving: '就诊中', completed: '已完成', cancelled: '已取消',
  };

  return (
    <div className="container">
      <button className="back-link" onClick={() => navigate({ page: 'home' })}>← 返回</button>
      <div className="page-title">我的预约</div>
      {loading ? (
        <div className="loading"><div className="spinner" />加载中...</div>
      ) : appointments.length === 0 ? (
        <div className="card empty-state"><p>暂无预约记录</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>排队号</th>
                <th>科室</th>
                <th>医生</th>
                <th>日期</th>
                <th>时段</th>
                <th>状态</th>
                <th>诊断</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id}>
                  <td className="font-bold text-primary">{a.queue_number}</td>
                  <td>{a.department_name}</td>
                  <td>{a.doctor_name} <span className="text-sm text-gray">{a.doctor_title}</span></td>
                  <td>{a.date}</td>
                  <td>{a.start_time}-{a.end_time}</td>
                  <td><span className={`status-${a.status}`}>{statusText[a.status]}</span></td>
                  <td>{a.diagnosis ? <span className="badge badge-success">已诊断</span> : '-'}</td>
                  <td>
                    {a.status === 'waiting' && (
                      <button className="btn btn-danger btn-sm" onClick={() => cancel(a.id)}>取消</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ Doctor Dashboard ============
function DoctorDashboard() {
  const { navigate } = useRouter();
  const { show } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagModal, setDiagModal] = useState<{ id: number; diagnosis: string } | null>(null);

  const load = () => {
    setLoading(true);
    api.getDoctorAppointments().then(setAppointments).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const callNext = async () => {
    try {
      const data = await api.callNext();
      if (data.appointment) {
        show(`已叫号：${data.appointment.patient_name}，排队号 ${data.appointment.queue_number}`, 'success');
      } else {
        show('暂无等待患者', 'info');
      }
      load();
    } catch (err: any) {
      show(err.message, 'error');
    }
  };

  const saveDiagnosis = async () => {
    if (!diagModal) return;
    try {
      await api.writeDiagnosis(diagModal.id, diagModal.diagnosis);
      show('诊断已保存', 'success');
      setDiagModal(null);
      load();
    } catch (err: any) {
      show(err.message, 'error');
    }
  };

  const waiting = appointments.filter(a => a.status === 'waiting');
  const serving = appointments.find(a => a.status === 'serving');
  const completed = appointments.filter(a => a.status === 'completed');

  const statusText: Record<string, string> = {
    waiting: '等待就诊', serving: '就诊中', completed: '已完成', cancelled: '已取消',
  };

  return (
    <div className="container">
      <div className="page-title">医生工作台</div>
      <div className="grid grid-3 mb-16">
        <div className="card stat-card">
          <div className="stat-number" style={{ color: '#f59e0b' }}>{waiting.length}</div>
          <div className="stat-desc">等待就诊</div>
        </div>
        <div className="card stat-card">
          <div className="stat-number">{serving ? '1' : '0'}</div>
          <div className="stat-desc">就诊中</div>
        </div>
        <div className="card stat-card">
          <div className="stat-number" style={{ color: '#16a34a' }}>{completed.length}</div>
          <div className="stat-desc">已完成</div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-16">
        <h3>今日排班</h3>
        <button className="btn btn-primary" onClick={callNext}>
          {serving ? '叫下一位' : '开始叫号'}
        </button>
      </div>

      {serving && (
        <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="flex justify-between items-center">
            <div>
              <span className="badge badge-primary">当前就诊</span>
              <span className="font-bold" style={{ marginLeft: 12, fontSize: 18 }}>{serving.patient_name}</span>
              <span className="text-sm text-gray" style={{ marginLeft: 8 }}>排队号 {serving.queue_number}</span>
              <span className="text-sm text-gray" style={{ marginLeft: 8 }}>{serving.start_time}-{serving.end_time}</span>
            </div>
            <button className="btn btn-success btn-sm" onClick={() => setDiagModal({ id: serving.id, diagnosis: serving.diagnosis || '' })}>
              写诊断
            </button>
          </div>
          {serving.diagnosis && <div className="diagnosis-box mt-8">诊断: {serving.diagnosis}</div>}
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" />加载中...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>排队号</th>
                <th>患者</th>
                <th>电话</th>
                <th>时段</th>
                <th>状态</th>
                <th>诊断</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(a => (
                <tr key={a.id}>
                  <td className="font-bold">{a.queue_number}</td>
                  <td>{a.patient_name}</td>
                  <td>{a.patient_phone}</td>
                  <td>{a.start_time}-{a.end_time}</td>
                  <td><span className={`status-${a.status}`}>{statusText[a.status]}</span></td>
                  <td>{a.diagnosis || '-'}</td>
                  <td>
                    {(a.status === 'serving' || a.status === 'completed') && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setDiagModal({ id: a.id, diagnosis: a.diagnosis || '' })}>
                        {a.diagnosis ? '修改诊断' : '写诊断'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diagModal && (
        <div className="modal-overlay" onClick={() => setDiagModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>填写诊断记录</h2>
            <div className="form-group">
              <label className="form-label">诊断内容</label>
              <textarea
                className="form-textarea"
                value={diagModal.diagnosis}
                onChange={e => setDiagModal({ ...diagModal, diagnosis: e.target.value })}
                placeholder="请输入诊断结果、用药建议等..."
              />
            </div>
            <div className="flex gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setDiagModal(null)}>取消</button>
              <button className="btn btn-primary" onClick={saveDiagnosis}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Queue Display (大屏) ============
function QueueDisplay({ departmentId }: { departmentId: number }) {
  const { navigate } = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    const load = () => {
      api.getQueueDisplay(departmentId).then(setData).catch(() => {}).finally(() => setLoading(false));
    };
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [departmentId]);

  return (
    <div className="queue-display">
      <h1 className="page-title">{data?.department?.name || ''} 排队叫号</h1>
      <div className="flex justify-center gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
        {departments.map(d => (
          <button key={d.id} className="btn btn-sm"
            style={{
              background: d.id === departmentId ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: 'white', border: '1px solid rgba(255,255,255,0.3)',
            }}
            onClick={() => navigate({ page: 'queue-display', departmentId: d.id })}>
            {d.name}
          </button>
        ))}
      </div>
      <div className="date-info">日期：{data?.date || new Date().toISOString().slice(0, 10)}</div>
      <button className="back-link" style={{ color: '#94a3b8', position: 'absolute', top: 20, left: 20 }} onClick={() => navigate({ page: 'queue-overview' })}>
        ← 总览
      </button>

      {loading ? (
        <div className="loading"><div className="spinner" />加载中...</div>
      ) : (
        <div className="grid grid-2" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {data?.doctor_queues?.map((dq: any) => (
            <div key={dq.doctor.id} className="queue-doctor-card">
              <div className="queue-doctor-name">{dq.doctor.name} <span style={{ fontSize: 14, fontWeight: 400, opacity: 0.6 }}>{dq.doctor.title}</span></div>

              {dq.current ? (
                <div className="queue-current">
                  <div className="label">当前叫号</div>
                  <div className="number">{dq.current.queue_number}</div>
                  <div className="patient">{dq.current.patient_name}</div>
                </div>
              ) : (
                <div className="queue-no-patient">暂未叫号</div>
              )}

              <div className="queue-stats">
                <div className="queue-stat">
                  <div className="stat-value" style={{ color: '#f59e0b' }}>{dq.waiting_count}</div>
                  <div className="stat-label">等待人数</div>
                </div>
                <div className="queue-stat">
                  <div className="stat-value" style={{ color: '#10b981' }}>{dq.completed_count}</div>
                  <div className="stat-label">已完成</div>
                </div>
                <div className="queue-stat">
                  <div className="stat-value" style={{ color: '#3b82f6' }}>{dq.estimated_wait_minutes}分</div>
                  <div className="stat-label">预计等待</div>
                </div>
              </div>

              {dq.waiting?.length > 0 && (
                <>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>等待队列</div>
                  <div className="queue-waiting-list">
                    {dq.waiting.map((w: any) => (
                      <span key={w.queue_number} className="queue-waiting-item">#{w.queue_number} {w.patient_name}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Queue Overview (总览大屏) ============
function QueueOverviewPage() {
  const { navigate } = useRouter();
  const { user } = useAuth();
  const [overview, setOverview] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      api.getQueueOverview().then(setOverview).catch(() => {}).finally(() => setLoading(false));
    };
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="queue-display">
      <h1 className="page-title">排队叫号总览</h1>
      <div className="date-info">日期：{new Date().toISOString().slice(0, 10)}</div>

      {loading ? (
        <div className="loading"><div className="spinner" />加载中...</div>
      ) : (
        <div className="grid grid-3" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {overview.map(dept => (
            <div key={dept.id} className="queue-doctor-card" style={{ cursor: 'pointer' }}
              onClick={() => navigate({ page: 'queue-display', departmentId: dept.id })}>
              <div className="queue-doctor-name">{dept.name}</div>
              <div className="queue-stats">
                <div className="queue-stat">
                  <div className="stat-value" style={{ color: '#f59e0b' }}>{dept.waiting}</div>
                  <div className="stat-label">等待中</div>
                </div>
                <div className="queue-stat">
                  <div className="stat-value" style={{ color: '#3b82f6' }}>{dept.serving}</div>
                  <div className="stat-label">就诊中</div>
                </div>
                <div className="queue-stat">
                  <div className="stat-value" style={{ color: '#10b981' }}>{dept.completed}</div>
                  <div className="stat-label">已完成</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
                点击查看详情
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Admin Dashboard ============
function AdminDashboard() {
  const { navigate } = useRouter();
  const [tab, setTab] = useState<'queue' | 'stats'>('queue');
  const [queues, setQueues] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (tab === 'queue') {
      setLoading(true);
      api.getAdminQueues().then(setQueues).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(true);
      api.getAdminStats(dateRange.start, dateRange.end).then(setStats).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab, dateRange]);

  return (
    <div className="container">
      <div className="page-title">管理员后台</div>

      <div className="flex gap-8 mb-16">
        <button className={`btn ${tab === 'queue' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('queue')}>排队监控</button>
        <button className={`btn ${tab === 'stats' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('stats')}>挂号统计</button>
        <button className="btn btn-ghost" onClick={() => navigate({ page: 'queue-overview' })}>排队大屏</button>
      </div>

      {tab === 'stats' && (
        <div className="flex gap-12 items-center mb-16">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">起始日期</label>
            <input className="form-input" type="date" value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">结束日期</label>
            <input className="form-input" type="date" value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" />加载中...</div>
      ) : tab === 'queue' ? (
        <>
          <div className="grid grid-4 mb-24">
            <div className="card stat-card">
              <div className="stat-number" style={{ color: '#f59e0b' }}>
                {queues.reduce((s, d) => s + d.total_waiting, 0)}
              </div>
              <div className="stat-desc">总等待人数</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number" style={{ color: '#16a34a' }}>
                {queues.reduce((s, d) => s + d.total_completed, 0)}
              </div>
              <div className="stat-desc">总已完成</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number">{queues.length}</div>
              <div className="stat-desc">科室数</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number">{queues.reduce((s, d) => s + d.doctors.length, 0)}</div>
              <div className="stat-desc">今日在岗医生</div>
            </div>
          </div>

          {queues.map(dept => (
            <div key={dept.id} className="card mb-16">
              <div className="card-title">{dept.name}</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>医生</th><th>职称</th><th>当前叫号</th><th>当前患者</th><th>等待</th><th>已完成</th></tr>
                  </thead>
                  <tbody>
                    {dept.doctors.map((doc: any) => (
                      <tr key={doc.id}>
                        <td className="font-bold">{doc.name}</td>
                        <td>{doc.title}</td>
                        <td className="text-primary font-bold">{doc.current_number || '-'}</td>
                        <td>{doc.current_patient || '-'}</td>
                        <td><span className="badge badge-warning">{doc.waiting}</span></td>
                        <td><span className="badge badge-success">{doc.completed}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : stats && (
        <>
          <div className="grid grid-4 mb-24">
            <div className="card stat-card">
              <div className="stat-number">{stats.total?.total || 0}</div>
              <div className="stat-desc">总挂号量</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number" style={{ color: '#16a34a' }}>{stats.total?.completed || 0}</div>
              <div className="stat-desc">已完成</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number" style={{ color: '#f59e0b' }}>{(stats.total?.waiting || 0) + (stats.total?.serving || 0)}</div>
              <div className="stat-desc">进行中</div>
            </div>
            <div className="card stat-card">
              <div className="stat-number" style={{ color: '#dc2626' }}>{stats.total?.cancelled || 0}</div>
              <div className="stat-desc">已取消</div>
            </div>
          </div>

          <div className="card mb-16">
            <div className="card-title">各科室挂号量</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>科室</th><th>总挂号量</th><th>已完成</th></tr></thead>
                <tbody>
                  {stats.by_department?.map((d: any, i: number) => (
                    <tr key={i}>
                      <td className="font-bold">{d.department_name}</td>
                      <td>{d.total}</td>
                      <td className="text-success">{d.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-title">每日明细</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>日期</th><th>科室</th><th>总数</th><th>已完成</th><th>已取消</th><th>进行中</th></tr></thead>
                <tbody>
                  {stats.daily?.map((d: any, i: number) => (
                    <tr key={i}>
                      <td>{d.date}</td>
                      <td>{d.department_name}</td>
                      <td>{d.total}</td>
                      <td className="text-success">{d.completed}</td>
                      <td className="text-danger">{d.cancelled}</td>
                      <td>{d.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============ App Root ============
export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [user, setUser] = useState<User | null>(null);
  const [toasts, setToasts] = useState<ToastType[]>([]);

  const show = useCallback((message: string, type: ToastType['type'] = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Handle hash changes
  useEffect(() => {
    const handler = () => setRoute(parseHash());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((r: Route) => {
    window.location.hash = routeToHash(r);
  }, []);

  // Try to restore session
  useEffect(() => {
    if (getToken()) {
      api.getMe().then(u => {
        if (u) setUser({ id: u.id, name: u.name, role: u.role || 'patient', username: u.username });
      }).catch(() => setToken(null));
    }
  }, []);

  const login = useCallback((token: string, u: User) => {
    setToken(token);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Prevent doctor/admin from accessing patient pages and vice versa
  const renderPage = () => {
    if (route.page === 'login') return <LoginPage />;
    if (route.page === 'queue-display') return <QueueDisplay departmentId={route.departmentId} />;
    if (route.page === 'queue-overview') return <QueueOverviewPage />;
    if (route.page === 'home') return <HomePage />;
    if (route.page === 'department') return <DepartmentPage id={route.id} />;

    // Protected routes
    if (!user) return <LoginPage />;
    if (route.page === 'book' && user.role === 'patient') return <BookingPage doctorId={route.doctorId} doctorName={route.doctorName} deptName={route.deptName} />;
    if (route.page === 'my-appointments' && user.role === 'patient') return <MyAppointmentsPage />;
    if (route.page === 'doctor' && user.role === 'doctor') return <DoctorDashboard />;
    if (route.page === 'admin' && user.role === 'admin') return <AdminDashboard />;

    // Wrong role
    if (user.role === 'doctor') return <DoctorDashboard />;
    if (user.role === 'admin') return <AdminDashboard />;
    return <HomePage />;
  };

  const noHeader = route.page === 'queue-display' || route.page === 'queue-overview';

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <ToastContext.Provider value={{ toasts, show }}>
        <RouterCtx.Provider value={{ route, navigate }}>
          {!noHeader && <Header />}
          <ToastContainer />
          {renderPage()}
        </RouterCtx.Provider>
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}
