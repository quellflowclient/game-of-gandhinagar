import assert from 'node:assert/strict';
import {emailAddress,emailOtpRequest} from '../src/backend/email.js';
for(const contact of ['9876543210','+919876543210','WhatsApp 9876543210','','a@','a b@example.com',null])assert.throws(()=>emailAddress(contact));
assert.equal(emailAddress(' Student+game@Example.com '),'student+game@example.com');
assert.equal(emailAddress('resident@college.ac.in'),'resident@college.ac.in');
assert.deepEqual(emailOtpRequest(' Student+game@Example.com ',{createUser:true,origin:'https://game-of-gandhinagar.vercel.app'}),{email:'student+game@example.com',options:{shouldCreateUser:true,emailRedirectTo:'https://game-of-gandhinagar.vercel.app'}});
assert.equal(emailOtpRequest('resident@college.ac.in').options.shouldCreateUser,false,'sign-in cannot silently create an account');
assert.equal(emailOtpRequest('resident@college.ac.in',{createUser:false}).options.shouldCreateUser,false);
console.log('Email-only auth passed: phone/WhatsApp numbers and malformed contacts rejected; email aliases and college domains accepted.');
