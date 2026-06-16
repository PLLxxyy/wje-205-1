import db from './db';
import bcrypt from 'bcryptjs';

console.log('正在初始化数据库...');

// Clear existing data
db.exec('DELETE FROM appointments');
db.exec('DELETE FROM time_slots');
db.exec('DELETE FROM patients');
db.exec('DELETE FROM doctors');
db.exec('DELETE FROM departments');
db.exec('DELETE FROM admins');

// Reset auto increment
db.exec("DELETE FROM sqlite_sequence WHERE name IN ('appointments','time_slots','patients','doctors','departments','admins')");

const salt = bcrypt.genSaltSync(10);

// Insert departments
const deptStmt = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)');
const departments = [
  ['内科', '治疗内脏疾病，包括心血管、呼吸、消化等方向'],
  ['外科', '各类手术治疗，包括普外、骨科、神经外科等'],
  ['儿科', '儿童及青少年疾病诊疗'],
  ['妇产科', '妇科疾病及孕产妇保健'],
  ['眼科', '眼部疾病诊疗及视力矫正'],
  ['耳鼻喉科', '耳、鼻、咽喉相关疾病诊疗'],
  ['皮肤科', '皮肤疾病诊疗'],
  ['口腔科', '牙齿及口腔疾病诊疗'],
];
const deptIds: Record<string, number> = {};
for (const [name, desc] of departments) {
  const info = deptStmt.run(name, desc);
  deptIds[name as string] = Number(info.lastInsertRowid);
}

// Insert doctors
const docStmt = db.prepare(
  'INSERT INTO doctors (username, password, name, title, department_id, bio) VALUES (?, ?, ?, ?, ?, ?)'
);
const doctors: Array<[string, string, string, string, string, string]> = [
  ['doc_wang', '123456', '王建国', '主任医师', '内科', '从医30年，擅长心脑血管疾病'],
  ['doc_li', '123456', '李明', '副主任医师', '内科', '呼吸系统疾病专家'],
  ['doc_zhang', '123456', '张伟', '主任医师', '外科', '普外科主任，微创手术专家'],
  ['doc_chen', '123456', '陈静', '副主任医师', '外科', '骨科方向，运动损伤专家'],
  ['doc_liu', '123456', '刘芳', '主任医师', '儿科', '儿童呼吸道疾病专家'],
  ['doc_zhao', '123456', '赵敏', '副主任医师', '妇产科', '围产期保健及高危妊娠管理'],
  ['doc_sun', '123456', '孙浩', '主治医师', '眼科', '近视矫正及白内障手术'],
  ['doc_wu', '123456', '吴强', '主任医师', '耳鼻喉科', '耳鼻喉科疑难杂症'],
  ['doc_zhou', '123456', '周莉', '主治医师', '皮肤科', '过敏性皮肤病及美容皮肤科'],
  ['doc_yang', '123456', '杨帆', '副主任医师', '口腔科', '种植牙及牙齿正畸'],
];
const docIds: Record<string, number> = {};
for (const [username, password, name, title, dept, bio] of doctors) {
  const info = docStmt.run(username, bcrypt.hashSync(password, salt), name, title, deptIds[dept], bio);
  docIds[username] = Number(info.lastInsertRowid);
}

// Insert admins
const adminStmt = db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)');
adminStmt.run('admin', bcrypt.hashSync('admin123', salt));

// Insert patients
const patStmt = db.prepare(
  'INSERT INTO patients (username, password, name, phone, id_card) VALUES (?, ?, ?, ?, ?)'
);
const patients: Array<[string, string, string, string, string]> = [
  ['patient_zhang', '123456', '张三', '13800001111', '110101199001011234'],
  ['patient_li', '123456', '李四', '13800002222', '110101199205052345'],
  ['patient_wang', '123456', '王五', '13800003333', '110101198812123456'],
];
for (const [username, password, name, phone, idCard] of patients) {
  patStmt.run(username, bcrypt.hashSync(password, salt), name, phone, idCard);
}

// Generate time slots for today and next 6 days
const slotStmt = db.prepare(
  'INSERT INTO time_slots (doctor_id, date, start_time, end_time, max_appointments) VALUES (?, ?, ?, ?, ?)'
);

const today = new Date();
for (let d = 0; d < 7; d++) {
  const date = new Date(today);
  date.setDate(today.getDate() + d);
  const dateStr = date.toISOString().slice(0, 10);

  const morningSlots = [
    ['08:00', '08:30'],
    ['08:30', '09:00'],
    ['09:00', '09:30'],
    ['09:30', '10:00'],
    ['10:00', '10:30'],
    ['10:30', '11:00'],
    ['11:00', '11:30'],
  ];
  const afternoonSlots = [
    ['14:00', '14:30'],
    ['14:30', '15:00'],
    ['15:00', '15:30'],
    ['15:30', '16:00'],
    ['16:00', '16:30'],
    ['16:30', '17:00'],
  ];

  for (const docId of Object.values(docIds)) {
    for (const [start, end] of [...morningSlots, ...afternoonSlots]) {
      slotStmt.run(docId, dateStr, start, end, 10);
    }
  }
}

console.log('种子数据初始化完成！');
console.log(`  - ${departments.length} 个科室`);
console.log(`  - ${doctors.length} 位医生`);
console.log(`  - ${patients.length} 位患者`);
console.log('  - 1 位管理员 (admin / admin123)');
console.log('  - 7 天的预约时段');
console.log('\n测试账号:');
console.log('  患者: patient_zhang / 123456');
console.log('  医生: doc_wang / 123456');
console.log('  管理员: admin / admin123');
