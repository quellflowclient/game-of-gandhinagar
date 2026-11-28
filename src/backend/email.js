// Match the live Supabase Email OTP length and supabase/config.toml.
export const EMAIL_OTP_LENGTH=6;

export function emailOtpCode(value){
  const code=String(value??'').replace(/\s/g,'');
  if(!/^\d{6}$/.test(code))throw new Error('Enter the 6-digit code from your email.');
  return code;
}

export function emailAddress(value){
  const email=String(value||'').trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');
  return email;
}

export function emailOtpRequest(contact,{createUser=false,origin}={}){
  return {email:emailAddress(contact),options:{shouldCreateUser:createUser===true,...(origin?{emailRedirectTo:origin}:{})}};
}
