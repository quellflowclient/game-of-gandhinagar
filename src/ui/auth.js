import {h,openPanel,setPanelBody,closePanel,toast} from './dom.js';
import {emailAddress,emailOtpCode,EMAIL_OTP_LENGTH} from '../backend/email.js';

export const openSignIn=(app,reason)=>openAuth(app,{reason});
export const openSignUp=(app,reason)=>openAuth(app,{mode:'signup',reason});

function openAuth(app,{mode='signin',reason,email=''}={}){
 const signup=mode==='signup',title=signup?'Create account':'Sign in';
 let active=true,busy=false,cooldown=0,focusTimer=0;
 const stopTimers=()=>{clearInterval(cooldown);clearTimeout(focusTimer);};
 const focus=field=>{clearTimeout(focusTimer);focusTimer=setTimeout(()=>{if(active)field.focus();},60);};
 const options={createUser:signup};
 const friendly=e=>/rate|seconds|too many/i.test(e?.message||'')?'Too many codes requested. Please wait a minute and try again.':/signups? not allowed|user not found|no account/i.test(e?.message||'')?'New here? Choose Sign up to create your account.':/invalid|expired/i.test(e?.message||'')?'That code is wrong or expired. Use the latest email or request a new code.':e?.message||'Could not connect. Please try again.';
 const contact=h('input',{type:'email',required:true,value:email,placeholder:'you@example.com',autocomplete:'email',inputmode:'email',class:'auth-input','aria-label':'Email address'});
 const adult=h('input',{type:'checkbox'}),terms=h('input',{type:'checkbox'});
 const note=h('p',{class:'auth-error',role:'alert'});
 const sendBtn=h('button',{type:'submit',class:'btn primary wide'},signup?'Send verification code':'Send sign-in code');
 const switchMode=next=>openAuth(app,{mode:next,reason,email:contact.value.trim()});
 const step1=h('form',{class:'auth',onsubmit:send},
  h('div',{class:'auth-modes',role:'group','aria-label':'Account access'},
   h('button',{type:'button','aria-pressed':String(signup),onclick:()=>switchMode('signup')},'Sign up'),
   h('button',{type:'button','aria-pressed':String(!signup),onclick:()=>switchMode('signin')},'Sign in')),
  h('div',{class:'auth-hero'},h('span',{class:'auth-kicker'},signup?'YOUR PLACE IN THE CITY':'GOOD TO SEE YOU AGAIN'),h('h3',{},signup?'Join Gandhinagar':'Welcome back'),
   h('p',{class:'muted'},signup?'Verify your email, then choose your name, character and colours.':reason?`Sign in to ${reason}.`:'Sign in to your account and continue with your saved character.')),
  h('label',{class:'auth-label'},'Email address',contact),
  ...(signup?[
   h('label',{class:'check'},adult,'I am 18 or older'),
   h('label',{class:'check auth-consent'},terms,h('span',{},'I agree to the ',h('a',{href:'/terms.html',target:'_blank',rel:'noopener noreferrer'},'Terms of Service'),' and ',h('a',{href:'/privacy.html',target:'_blank',rel:'noopener noreferrer'},'Privacy Policy'),'.'))
  ]:[]),sendBtn,note,
  h('p',{class:'muted small auth-foot'},'No password needed. Use the one-time code sent to your email. Your email stays private.'),
  h('p',{class:'auth-switch'},signup?'Already have an account? ':'New to the game? ',h('button',{type:'button',class:'link',onclick:()=>switchMode(signup?'signin':'signup')},signup?'Sign in':'Sign up')));
 async function send(event){
  event?.preventDefault();if(busy||!active)return;note.textContent='';
  try{email=emailAddress(contact.value);}catch{note.textContent='Enter a valid email address.';contact.focus();return;}
  if(signup&&(!adult.checked||!terms.checked)){note.textContent='Confirm your age and agree to the terms to create an account.';return;}
  busy=true;sendBtn.disabled=true;sendBtn.textContent='Sending…';
  try{const result=await app.backend.signInWithOtp(email,options);if(active)codeStep(result);}
  catch(e){if(active){note.textContent=friendly(e);sendBtn.disabled=false;sendBtn.textContent=signup?'Send verification code':'Send sign-in code';}}
  finally{busy=false;}
 }
 function codeStep(result){
  const code=h('input',{type:'text',inputmode:'numeric',autocomplete:'one-time-code',maxlength:EMAIL_OTP_LENGTH,minlength:EMAIL_OTP_LENGTH,pattern:'[0-9]{6}',required:true,placeholder:'000000',class:'otp-input','aria-label':'6-digit code'});
  const error=h('p',{class:'auth-error',role:'alert'});
  const verifyBtn=h('button',{type:'submit',class:'btn primary wide'},signup?'Verify and continue':'Verify and sign in');
  const resend=h('button',{type:'button',class:'link',disabled:true,onclick:resendCode},'Resend code in 30s');
  function startCooldown(){
   clearInterval(cooldown);const until=Date.now()+30000;
   const tick=()=>{const left=Math.max(0,Math.ceil((until-Date.now())/1000));resend.disabled=left>0;resend.textContent=left?`Resend code in ${left}s`:'Resend code';if(!left)clearInterval(cooldown);};
   tick();cooldown=setInterval(tick,1000);
  }
  async function resendCode(){
   if(resend.disabled||busy||!active)return;busy=true;resend.disabled=true;verifyBtn.disabled=true;error.textContent='';
   try{await app.backend.signInWithOtp(email,options);if(active){startCooldown();toast('New code sent.');}}
   catch(e){if(active){error.textContent=friendly(e);resend.disabled=false;}}
   finally{busy=false;if(active)verifyBtn.disabled=false;}
  }
  async function verify(event){
   event?.preventDefault();if(busy||!active)return;
   let value;
   try{value=emailOtpCode(code.value);}catch(e){error.textContent=e.message;code.focus();return;}
   busy=true;verifyBtn.disabled=true;verifyBtn.textContent='Checking…';error.textContent='';
   try{await app.backend.verifyOtp(email,value);}
   catch(e){if(active){error.textContent=friendly(e);verifyBtn.disabled=false;verifyBtn.textContent=signup?'Verify and continue':'Verify and sign in';code.select();}busy=false;return;}
   if(!active)return;closePanel();
   try{await app.onSignedIn();}catch(e){toast(e?.message||'Email verified. Open Profile to finish setting up your account.','bad');}
  }
  const oldCode=()=>{code.value='';error.textContent='Request a new 6-digit code. Use the latest email.';};
  code.addEventListener('paste',event=>{if((event.clipboardData?.getData('text')||'').replace(/\D/g,'').length>EMAIL_OTP_LENGTH){event.preventDefault();oldCode();}});
  code.addEventListener('input',()=>{const digits=code.value.replace(/\D/g,'');if(digits.length>EMAIL_OTP_LENGTH){oldCode();return;}code.value=digits;error.textContent='';if(digits.length===EMAIL_OTP_LENGTH)void verify();});
  setPanelBody(h('form',{class:'auth',onsubmit:verify},
   h('div',{class:'auth-hero'},h('span',{class:'auth-kicker'},signup?'STEP 1 / VERIFY YOUR EMAIL':'CHECK YOUR INBOX'),h('h3',{},'Check your email'),h('p',{class:'muted'},'Enter the 6-digit code sent to ',h('b',{},email),'.')),
   app.backend.mode==='demo'&&result?.demoCode?h('p',{class:'demo-note'},`Demo mode (no email sent): ${result.demoCode}`):null,
   h('label',{class:'auth-label'},'Verification code',code),verifyBtn,error,
   h('div',{class:'auth-row'},resend,h('button',{type:'button',class:'link',onclick:()=>openAuth(app,{mode,reason,email})},'Change email')),
   h('p',{class:'muted small auth-foot'},'Use the latest code. Check Spam or Promotions if the email has not arrived.')));
  startCooldown();focus(code);
 }
 openPanel(title,step1,{onClose:()=>{active=false;stopTimers();}});focus(contact);
}
