import{t as e}from"./index-DSjy--_U.js";var t=e(((e,t,n)=>{(function(n,r){typeof e==`object`&&typeof t==`object`?t.exports=r():typeof define==`function`&&define.amd?define([],r):typeof e==`object`?e["grapesjs-component-countdown"]=r():n[`grapesjs-component-countdown`]=r()})(typeof globalThis<`u`?globalThis:typeof window<`u`?window:n,(()=>(()=>{var e={d:(t,n)=>{for(var r in n)e.o(n,r)&&!e.o(t,r)&&Object.defineProperty(t,r,{enumerable:!0,get:n[r]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{typeof Symbol<`u`&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:`Module`}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};e.r(t),e.d(t,{default:()=>r});var n=function(){return n=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var i in t=arguments[n])Object.prototype.hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e},n.apply(this,arguments)};let r=function(e,t){t===void 0&&(t={});var r=n({id:`countdown`,label:`Countdown`,block:{},props:{},style:``,styleAdditional:``,startTime:``,endText:`EXPIRED`,dateInputType:`date`,labelDays:`days`,labelHours:`hours`,labelMinutes:`minutes`,labelSeconds:`seconds`,classPrefix:`countdown`},t),i=r.block,a=r.props,o=r.style,s=r.id,c=r.label,l=r.classPrefix;i&&e.Blocks.add(s,n({media:`<svg viewBox="0 0 24 24">
        <path fill="currentColor" d="M12 20C16.4 20 20 16.4 20 12S16.4 4 12 4 4 7.6 4 12 7.6 20 12 20M12 2C17.5 2 22 6.5 22 12S17.5 22 12 22C6.5 22 2 17.5 2 12C2 6.5 6.5 2 12 2M17 11.5V13H11V7H12.5V11.5H17Z" />
      </svg>`,label:c,category:`Extra`,select:!0,content:{type:s}},i)),e.Components.addType(s,{model:{defaults:n({startfrom:r.startTime,classes:[l],endText:r.endText,droppable:!1,script:function(e){var t=e.startfrom,n=e.endText,r=this,i=new Date(t).getTime(),a=r.querySelector(`[data-js=countdown]`),o=r.querySelector(`[data-js=countdown-endtext]`),s=r.querySelector(`[data-js=countdown-day]`),c=r.querySelector(`[data-js=countdown-hour]`),l=r.querySelector(`[data-js=countdown-minute]`),u=r.querySelector(`[data-js=countdown-second]`),d=r.__gjsCountdownInterval;d&&clearInterval(d);var f=window.__gjsCountdownIntervals||[],p=[];f.forEach((function(e){e.isConnected||(clearInterval(e.__gjsCountdownInterval),p.push(e))})),f.indexOf(r)<0&&f.push(r),window.__gjsCountdownIntervals=f.filter((function(e){return p.indexOf(e)<0}));var m=function(e,t,n,r){s.innerHTML=`${e<10?`0`+e:e}`,c.innerHTML=`${t<10?`0`+t:t}`,l.innerHTML=`${n<10?`0`+n:n}`,u.innerHTML=`${r<10?`0`+r:r}`},h=function(){var e=i-new Date().getTime();m(Math.floor(e/864e5),Math.floor(e%864e5/36e5),Math.floor(e%36e5/6e4),Math.floor(e%6e4/1e3)),e<0&&(clearInterval(r.__gjsCountdownInterval),o.innerHTML=n,a.style.display=`none`,o.style.display=``)};i?(r.__gjsCountdownInterval=setInterval(h,1e3),o.style.display=`none`,a.style.display=``,h()):m(0,0,0,0)},"script-props":[`startfrom`,`endText`],traits:[{label:`Start`,name:`startfrom`,changeProp:!0,type:r.dateInputType},{label:`End text`,name:`endText`,changeProp:!0}],components:`
          <span data-js="countdown" class="${l}-cont">
            <div class="${l}-block">
              <div data-js="countdown-day" class="${l}-digit"></div>
              <div class="${l}-label">${r.labelDays}</div>
            </div>
            <div class="${l}-block">
              <div data-js="countdown-hour" class="${l}-digit"></div>
              <div class="${l}-label">${r.labelHours}</div>
            </div>
            <div class="${l}-block">
              <div data-js="countdown-minute" class="${l}-digit"></div>
              <div class="${l}-label">${r.labelMinutes}</div>
            </div>
            <div class="${l}-block">
              <div data-js="countdown-second" class="${l}-digit"></div>
              <div class="${l}-label">${r.labelSeconds}</div>
            </div>
          </span>
          <span data-js="countdown-endtext" class="${l}-endtext"></span>
        `,styles:(o||`
          .${l} {
            text-align: center;
          }

          .${l}-block {
            display: inline-block;
            margin: 0 10px;
            padding: 10px;
          }

          .${l}-digit {
            font-size: 5rem;
          }

          .${l}-endtext {
            font-size: 5rem;
          }

          .${l}-cont {
            display: inline-block;
          }
        `)+r.styleAdditional},a)}})};return t})()))}));export default t();