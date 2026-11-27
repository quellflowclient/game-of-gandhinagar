import assert from 'node:assert/strict';
import {ALL_LOOKS,lookById,encodeLook} from '../src/data/content.js';
for(const original of ALL_LOOKS){assert.equal(lookById(original.id),original);const custom=lookById(encodeLook(original.id,{top:0x234567,bottom:0x345678,hair:0x181414,shoes:0x282828}));assert.equal(custom.id,original.id);assert.equal(!!custom.long,!!original.long);assert.equal(custom.top,0x234567);assert.equal(custom.bottom,0x345678);assert.equal(custom.hair,0x181414);assert.equal(custom.shoes,0x282828);assert.ok(encodeLook(original.id,custom).length<80);}
for(const value of ['casual~zzzzzz~123456~123456~123456','casual~fff','casual~123456~123456~123456~123456~123456'])assert.equal(lookById(value),lookById('casual'));
assert.equal(lookById('fcasual~ABCDEF~123456~181414~282828').top,0xabcdef);assert.equal(lookById('does-not-exist').id,lookById().id);
console.log('Appearance passed: original looks remain compatible; male/female bodies and all four colour choices survive profile/presence serialization; malformed colours fall back safely.');
