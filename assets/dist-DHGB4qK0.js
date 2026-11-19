import{t as e}from"./index-DSjy--_U.js";var t=e(((e,t,n)=>{(function(n,r){typeof e==`object`&&typeof t==`object`?t.exports=r():typeof define==`function`&&define.amd?define([],r):typeof e==`object`?e["grapesjs-tooltip"]=r():n[`grapesjs-tooltip`]=r()})(typeof globalThis<`u`?globalThis:typeof window<`u`?window:n,(()=>(()=>{var e={d:(t,n)=>{for(var r in n)e.o(n,r)&&!e.o(t,r)&&Object.defineProperty(t,r,{enumerable:!0,get:n[r]})},o:(e,t)=>Object.prototype.hasOwnProperty.call(e,t),r:e=>{typeof Symbol<`u`&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:`Module`}),Object.defineProperty(e,"__esModule",{value:!0})}},t={};e.r(t),e.d(t,{default:()=>r});var n=function(){return n=Object.assign||function(e){for(var t,n=1,r=arguments.length;n<r;n++)for(var i in t=arguments[n])Object.prototype.hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e},n.apply(this,arguments)};let r=function(e,t){var r;t===void 0&&(t={});var i=n({id:`tooltip`,labelTooltip:`Tooltip`,blockTooltip:{},propsTooltip:{},extendTraits:function(e){return e},attrTooltip:`data-tooltip`,classTooltip:`tooltip-component`,style:``,styleAdditional:``,privateClasses:!0,stylableTooltip:[`background-color`,`padding`,`padding-top`,`padding-right`,`padding-bottom`,`padding-left`,`font-family`,`font-size`,`font-weight`,`letter-spacing`,`color`,`line-height`,`text-align`,`border-radius`,`border-top-left-radius`,`border-top-right-radius`,`border-bottom-left-radius`,`border-bottom-right-radius`,`border`,`border-width`,`border-style`,`border-color`],showTooltipOnStyle:!0},t),a=i.propsTooltip,o=i.classTooltip,s=i.style,c=i.styleAdditional,l=i.privateClasses,u=i.stylableTooltip,d=i.showTooltipOnStyle,f=i.blockTooltip,p=i.extendTraits,m=i.id,h=i.labelTooltip,g=i.attrTooltip;f&&e.BlockManager.add(m,n({media:`<svg viewBox="0 0 24 24">
          <path d="M4 2h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2h-4l-4 4-4-4H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2m0 2v12h4.83L12 19.17 15.17 16H20V4H4z"></path>
        </svg>`,label:h,category:`Extra`,select:!0,content:{type:m}},f));var _=`${o}__body`,v=`${o}--empty`,y=`${g}-visible`,b=`${g}-pos`,x=`${g}-length`;l&&e.SelectorManager.getAll().add([{private:1,name:o},{private:1,name:_},{private:1,name:v}]),e.Components.addType(m,{isComponent:function(e){return e.hasAttribute?.call(e,g)},model:{defaults:n({name:h,classes:[o],attributes:(r={},r[g]=h,r),styles:(s||`
          .${o} {
            position: relative;
            display: inline-block;
            vertical-align: top;
          }

          .${v} {
            width: 50px;
            height: 50px;
          }

          .${_},
          [${g}]::after {
            font-family: Helvetica, sans-serif;
            background: rgba(55, 61, 73, 0.95);
            border-radius: 3px;
            bottom: 100%;
            color: #fff;
            content: attr(${g});
            display: block;
            font-size: 12px;
            left: 50%;
            line-height: normal;
            max-width: 32rem;
            opacity: 0;
            overflow: hidden;
            padding: 8px 16px;
            pointer-events: none;
            position: absolute;
            text-overflow: ellipsis;
            transform: translate(-50%, 0);
            transition: opacity 0.25s, transform 0.25s;
            white-space: nowrap;
            box-sizing: border-box;
            z-index: 10;
          }

          [${y}=true]::after,
          [${g}]:focus::after,
          [${g}]:hover::after {
            opacity: 1;
            transform: translate(-50%, -0.5rem);
          }

          [${b}=right]::after {
            bottom: 50%;
            left: 100%;
            transform: translate(0, 50%);
          }

          [${b}=right]:focus::after,
          [${b}=right]:hover::after,
          [${y}=true][${b}=right]::after {
            transform: translate(0.5rem, 50%);
          }

          [${b}=bottom]::after {
            bottom: auto;
            top: 100%;
            transform: translate(-50%, 0);
          }

          [${b}=bottom]:focus::after,
          [${b}=bottom]:hover::after,
          [${y}=true][${b}=bottom]::after {
            transform: translate(-50%, 0.5rem);
          }

          [${b}=left]::after {
            bottom: 50%;
            left: auto;
            right: 100%;
            transform: translate(0, 50%);
          }

          [${b}=left]:focus::after,
          [${b}=left]:hover::after,
          [${y}=true][${b}=left]::after {
            transform: translate(-0.5rem, 50%);
          }

          [${x}=small]::after {
            white-space: normal;
            width: 80px;
          }

          [${x}=medium]::after {
            white-space: normal;
            width: 150px;
          }

          [${x}=large]::after {
            white-space: normal;
            width: 300px;
          }

          [${x}=fit]::after {
            white-space: normal;
            width: 100%;
          }

          // IE 11 bugfix
          button[${g}] {
            overflow: visible;
          }
        `)+c,traits:p([{name:g,label:`Text`},{name:b,label:`Position`,type:`select`,options:[{value:`top`,name:`Top`},{value:`right`,name:`Right`},{value:`bottom`,name:`Bottom`},{value:`left`,name:`Left`}]},{name:x,label:`Length`,type:`select`,options:[{value:``,name:`One line`},{value:`small`,name:`Small`},{value:`medium`,name:`Medium`},{value:`large`,name:`Large`},{value:`fit`,name:`Fit`}]},{name:y,label:`Visible`,type:`checkbox`,valueTrue:`true`},{name:`style-tooltip`,labelButton:`Style tooltip`,type:`button`,full:!0,command:function(e){var t;e.Panels.getButton(`views`,`open-sm`)?.set(`active`,!0);var n=e.Css.getRules(`.${_}`)[0];if(n.set(`stylable`,u),e.StyleManager.select(n),d){var r=e.getSelected();r!=null&&r.is(m)&&(r.addAttributes(((t={})[y]=`true`,t)),e.once(`style:target`,(function(){var e;r.addAttributes(((e={})[y]=`false`,e))})))}}}])},a),init:function(){this.listenTo(this.components(),`add remove`,this.checkEmpty),this.checkEmpty()},checkEmpty:function(){this[this.components().length?`removeClass`:`addClass`](`${v}`)}}})};return t})()))}));export default t();