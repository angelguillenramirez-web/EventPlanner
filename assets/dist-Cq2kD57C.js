import{t as e}from"./index-DSjy--_U.js";var t=e(((e,t,n)=>{(function(n,r){typeof e==`object`&&typeof t==`object`?t.exports=r():typeof define==`function`&&define.amd?define([],r):typeof e==`object`?e["grapesjs-navbar"]=r():n[`grapesjs-navbar`]=r()})(typeof globalThis<`u`?globalThis:typeof window<`u`?window:n,(()=>(()=>{var e={d:(t,n)=>{for(var r in n)e.o(n,r)&&!e.o(t,r)&&Object.defineProperty(t,r,{enumerable:!0,get:n[r]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{typeof Symbol<`u`&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:`Module`}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};e.r(t),e.d(t,{default:()=>a});var n=function(){return n=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var i in t=arguments[n])Object.prototype.hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e},n.apply(this,arguments)};let r=function(e,t){var n=e.Components,r=t.id,i=t.label,a=t.classPrefix,o=`${r}-container`,s=`${r}-nav-menu`,c=`${r}-nav-menu-link`,l=`${r}-burger-menu`,u=`${r}-burger-menu-line`;n.addType(r,{model:{defaults:{droppable:!1,name:i,attributes:{class:a},components:{type:o},styles:(t.style||`
          .${a} {
            background-color: #222;
            color: #ddd;
            min-height: 50px;
            width: 100%;
          }

          .${a}-container {
            max-width: 950px;
            margin: 0 auto;
            width: 95%;
          }

          .${a}-items-c {
            display: inline-block;
            float: right;
          }

          .${a}-container::after {
            content: "";
            clear: both;
            display: block;
          }

          .${a}-brand {
            vertical-align: top;
            display: inline-block;
            padding: 5px;
            min-height: 50px;
            min-width: 50px;
            color: inherit;
            text-decoration: none;
          }

          .${a}-menu {
            padding: 10px 0;
            display: block;
            float: right;
            margin: 0;
          }

          .${a}-menu-link {
            margin: 0;
            color: inherit;
            text-decoration: none;
            display: inline-block;
            padding: 10px 15px;
          }

          .${a}-burger {
            margin: 10px 0;
            width: 45px;
            padding: 5px 10px;
            display: none;
            float: right;
            cursor: pointer;
          }

          .${a}-burger-line {
            padding: 1px;
            background-color: white;
            margin: 5px 0;
          }

          @media (max-width: 768px) {
            .${a}-items-c {
              display: none;
              width: 100%;
            }

            .${a}-burger {
              display: block;
            }

            .${a}-menu {
              width: 100%;
            }

            .${a}-menu-link {
              display: block;
            }
          }
        `)+t.styleAdditional}}}),n.addType(o,{model:{defaults:{attributes:{class:`${a}-container`,"data-gjs":`navbar`},name:`Navbar Container`,droppable:!1,draggable:!1,removable:!1,copyable:!1,highlightable:!1,components:[{type:`link`,attributes:{class:`${a}-brand`,href:`/`}},{type:l},{attributes:{class:`${a}-items-c`,"data-gjs":`navbar-items`},components:{type:s}}]}}}),n.addType(s,{model:{defaults:{name:`Navbar Menu`,tagName:`nav`,attributes:{class:`${a}-menu`},components:[{type:c,components:`Home`},{type:c,components:`About`},{type:c,components:`Contact`}]}}}),n.addType(c,{extend:`link`,model:{defaults:{name:`Menu link`,draggable:`[data-gjs-type="${s}"]`,attributes:{class:`${a}-menu-link`}}}}),n.addType(l,{model:{defaults:{name:`Burger`,draggable:!1,droppable:!1,copyable:!1,removable:!1,script:function(){var e,t=this,n=`gjs-collapse`,r=`max-height`,i=0,a=function(){var e=document.createElement(`void`),t={transition:`transitionend`,OTransition:`oTransitionEnd`,MozTransition:`transitionend`,WebkitTransition:`webkitTransitionEnd`};for(var n in t)if(e.style[n]!==void 0)return t[n]}(),o=function(e){i=1;var t=function(e){var t=window.getComputedStyle(e),n=t.display,i=parseInt(t[r]);if(n!==`none`&&i!==0)return e.offsetHeight;e.style.height=`auto`,e.style.display=`block`,e.style.position=`absolute`,e.style.visibility=`hidden`;var a=e.offsetHeight;return e.style.height=``,e.style.display=``,e.style.position=``,e.style.visibility=``,a}(e),n=e.style;n.display=`block`,n.transition=`${r} 0.25s ease-in-out`,n.overflowY=`hidden`,n[r]==``&&(n[r]=0),parseInt(n[r])==0?(n[r]=`0`,setTimeout((function(){n[r]=t+`px`}),10)):n[r]=`0`};n in t||t.addEventListener(`click`,(function(n){if(n.preventDefault(),!i){var s=t.closest(`[data-gjs=navbar]`)?.querySelector(`[data-gjs=navbar-items]`);s&&o(s),e||=(s?.addEventListener(a,(function(){i=0;var e=s.style;parseInt(e[r])==0&&(e.display=``,e[r]=``)})),1)}})),t[n]=1},attributes:{class:`${a}-burger`},components:[{type:u},{type:u},{type:u}]}}}),n.addType(u,{model:{defaults:{name:`Burger Line`,droppable:!1,draggable:!1,highlightable:!1,attributes:{class:`${a}-burger-line`}}}})};var i=function(){return i=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var i in t=arguments[n])Object.prototype.hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e},i.apply(this,arguments)};let a=function(e,t){t===void 0&&(t={});var a=i({id:`navbar`,label:`Navbar`,block:{},style:``,styleAdditional:``,classPrefix:`navbar`},t);(function(e,t){var r=t.block,i=t.label,a=t.id;r&&e.Blocks.add(a,n({media:`<svg viewBox="0 0 24 24">
        <path d="M22 9c0-.6-.5-1-1.25-1H3.25C2.5 8 2 8.4 2 9v6c0 .6.5 1 1.25 1h17.5c.75 0 1.25-.4 1.25-1V9Zm-1 6H3V9h18v6Z"/><path d="M15 10h5v1h-5zM15 13h5v1h-5zM15 11.5h5v1h-5z"/>
      </svg>`,label:i,category:`Extra`,select:!0,content:{type:a}},r))})(e,a),r(e,a)};return t})()))}));export default t();