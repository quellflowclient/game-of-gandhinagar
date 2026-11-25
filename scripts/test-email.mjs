import assert from 'node:assert/strict';
import {emailAddress} from '../src/backend/email.js';
for(const contact of ['9876543210','+919876543210','WhatsApp 9876543210','','a@','a b@example.com',null])assert.throws(()=>emailAddress(contact));
assert.equal(emailAddress(' Student+game@Example.com '),'student+game@example.com');
assert.equal(emailAddress('resident@college.ac.in'),'resident@college.ac.in');
console.log('Email-only auth passed: phone/WhatsApp numbers and malformed contacts rejected; email aliases and college domains accepted.');
