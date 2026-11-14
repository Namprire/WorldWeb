import test from 'node:test';
import assert from 'node:assert/strict';
import {createRider,step,delivery} from './simulation.ts';
const idle={throttle:0,brake:0,steer:0,jump:false,leap:false,trick:false};
test('pedaling collects once and delivers through normal movement',()=>{const s=createRider();for(let n=0;n<900;n++)step(s,{...idle,throttle:1},1/60);assert.ok(s.banked>=150);assert.ok(s.collected.size>=15);const bank=s.banked;s.x=delivery.x;s.z=delivery.z;step(s,idle,1/60);assert.equal(s.banked,bank);});
test('braking reduces speed and wall blocks movement',()=>{const s=createRider();s.speed=10;for(let n=0;n<60;n++)step(s,{...idle,brake:1},1/60);assert.ok(s.speed<.1);const b=createRider();for(let n=0;n<180;n++)step(b,{...idle,throttle:1},1/60,[{x:0,z:-3,w:8,d:4,h:4}]);assert.ok(b.z>=-.5);});
test('jump returns to ground and rewards a completed trick',()=>{const s=createRider();step(s,{...idle,leap:true},1/60);assert.ok(s.y>0);for(let n=0;n<90;n++)step(s,{...idle,trick:true},1/60);assert.equal(s.y,0);assert.equal(s.grounded,true);assert.equal(s.points,50);});
test('flight stays finite and within its altitude bound',()=>{const s=createRider();s.flying=true;s.grounded=false;s.y=1;for(let n=0;n<1200;n++)step(s,{...idle,jump:true,throttle:1},1/60);assert.ok(s.y<=24&&s.y>0);assert.ok(Number.isFinite(s.z));});
