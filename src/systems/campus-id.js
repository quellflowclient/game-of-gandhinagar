import {CONTENT} from './game-content.js';
export const DEGREES={BE:{label:'Bachelor of Engineering',years:4},BTECH:{label:'Bachelor of Technology',years:4},BCA:{label:'Bachelor of Computer Applications',years:3},MBA:{label:'Master of Business Administration',years:2},MCA:{label:'Master of Computer Applications',years:2},D2D:{label:'Diploma to Degree',years:3},ME:{label:'Master of Engineering',years:2},MTECH:{label:'Master of Technology',years:2},DIPLOMA:{label:'Diploma',years:3}};
export const BRANCHES={CE:'Computer Engineering',IT:'Information Technology',CSE:'Computer Science & Engineering',EC:'Electronics & Communication',ECT:'Electronics & Communication Technology',EE:'Electrical Engineering',ME:'Mechanical Engineering',CIVIL:'Civil Engineering',AI:'Artificial Intelligence',AIML:'AI & Machine Learning',DS:'Data Science',GENERAL:'General'};
export const currentYear=()=>new Date(Date.now()+19800000).getUTCFullYear();
export function parseEnrollment(value){const text=String(value||'').trim().toUpperCase();if(!/^\d{2}[A-Z0-9]+\d{5}$/.test(text))return null;for(const degree of Object.keys(DEGREES).sort((a,b)=>b.length-a.length))for(const branch of Object.keys(BRANCHES).sort((a,b)=>b.length-a.length)){const match=text.match(new RegExp(`^(\\d{2})${degree}${branch}(\\d{5})$`));if(match)return{number:text.toLowerCase(),yearCode:Number(match[1]),degree,branch,serial:match[2]};}return null;}
export function idErrors(id){
 const errors=[];if(id?.version!==2)return['Complete your college ID or visitor pass form first.'];
 if(String(id.name||'').trim().length<2)errors.push('Enter your full name.');
 if(id.kind==='visitor'){
  if(!new RegExp(`^\\d{${CONTENT.campus.phoneDigits}}$`).test(id.phone||''))errors.push(`Mobile number must contain exactly ${CONTENT.campus.phoneDigits} digits.`);
  for(const [key,label]of [['purpose','Reason for visit'],['meeting','Person / department to meet'],['from','Where you are coming from']])if(String(id[key]||'').trim().length<2)errors.push(`${label} is required.`);
 }else if(id.kind==='college'){
  const parsed=parseEnrollment(id.number),admission=Number(id.admissionYear),graduation=Number(id.graduationYear),semester=Number(id.semester);
  if(!parsed)errors.push('Enrollment must be 2 year digits + degree code + branch code + exactly 5 digits, e.g. 22bece00000.');
  if(!DEGREES[id.degree]||!BRANCHES[id.branch])errors.push('Choose a supported degree and branch.');
  if(!Number.isInteger(admission)||admission<CONTENT.campus.minimumAdmissionYear||admission>currentYear())errors.push(`Enter a valid admission year (${CONTENT.campus.minimumAdmissionYear} to current year).`);
  if(parsed&&(parsed.yearCode!==admission%100||parsed.degree!==id.degree||parsed.branch!==id.branch))errors.push('Enrollment year, degree and branch must match the form.');
  const years=DEGREES[id.degree]?.years||4;
  if(!Number.isInteger(graduation)||graduation<admission+years||graduation>currentYear()+years)errors.push('Graduation year must allow the course duration and be a valid completed or expected year.');
  if(!Number.isInteger(semester)||semester<1||semester>years*2)errors.push(`Semester must be between 1 and ${years*2}.`);
  if(String(id.address||'').trim().length<CONTENT.campus.minimumAddressLength)errors.push(`Enter your full address (at least ${CONTENT.campus.minimumAddressLength} characters).`);
 }else errors.push('Choose college member or outside visitor.');
 return errors;
}
// Pass records are replaced on save; avoid repeating form validation per frame.
const validity=new WeakMap();
export function validCampusId(id){if(!id||typeof id!=='object')return false;if(!validity.has(id))validity.set(id,idErrors(id).length===0);return validity.get(id);}
