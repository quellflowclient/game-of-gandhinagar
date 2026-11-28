export function emailAddress(value){
  const email=String(value||'').trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
  return email;
}

export function emailOtpRequest(contact,{createUser=false,origin}={}){
  return {email:emailAddress(contact),options:{shouldCreateUser:createUser===true,...(origin?{emailRedirectTo:origin}:{})}};
}
