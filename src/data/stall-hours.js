// Business hours are in Gandhinagar's local time (IST), end hour exclusive.
export const STALL_HOURS={babu:{open:8,close:16,closedDays:[0]},chintu:{open:8,close:16},lalbhai:{open:6,close:21},natu:{open:6,close:23},masi:{open:6,close:20},sarpanch:{open:6,close:20},patel:{open:6,close:22},ajit:{open:6,close:23}};
export const istWeekday=(date=new Date())=>new Date(date.getTime()+19800000).getUTCDay();
export const businessHour=h=>`${h%12||12} ${h>=12?'PM':'AM'}`;
export function stallAvailability(shop,hour,weekday=istWeekday()){
 const s=STALL_HOURS[shop.id]||{open:8,close:20};
 if(s.closedDays?.includes(weekday))return{open:false,text:'Sunday closed · Monday 8 AM',hours:`${businessHour(s.open)} – ${businessHour(s.close)} · Sunday closed`};
 const open=hour>=s.open&&hour<s.close;
 return{open,text:open?`Open until ${businessHour(s.close)}`:`Closed · opens ${businessHour(s.open)}`,hours:`${businessHour(s.open)} – ${businessHour(s.close)}${s.closedDays?' · Sunday closed':''}`};
}
