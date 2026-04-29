function b(o,s){if(!o.length)return;const t=Object.keys(o[0]),r="\uFEFF"+[t.join(";"),...o.map(i=>t.map(u=>{const d=i[u]??"",n=String(d);return n.includes(";")||n.includes('"')||n.includes(`
`)?`"${n.replace(/"/g,'""')}"`:n}).join(";"))].join(`\r
`),l=new Blob([r],{type:"text/csv;charset=utf-8;"}),c=URL.createObjectURL(l),e=document.createElement("a");e.href=c,e.download=s,document.body.appendChild(e),e.click(),document.body.removeChild(e),URL.revokeObjectURL(c)}export{b as e};
