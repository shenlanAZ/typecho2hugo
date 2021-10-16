const path = require("path");
const fs = require('fs');
const del = require('del');
const Database = require('better-sqlite3');

const db = new Database('typecho.db', { verbose: console.log, readonly: true });

const tmpFolder = path.resolve(__dirname, 'typecho2hugo');
if (fs.existsSync(tmpFolder)) {
  del.sync(path.resolve(tmpFolder, '*'));
} else {
  fs.mkdirSync(tmpFolder, 0744);
}

const prefix = 'typecho_'
const stmt = db.prepare(`SELECT cid,title,text,created,slug,type FROM ${prefix}contents`);
const relationships = db.prepare(`SELECT cid,mid FROM ${prefix}relationships`).all().reduce((obj, cur) => {
  if (Array.isArray(obj[cur.cid])) {
    obj[cur.cid].push(cur.mid);
  } else {
    obj[cur.cid] = [cur.mid];
  }
  return obj;
}, {});
const metas = db.prepare(`SELECT mid,name,type FROM ${prefix}metas`).all().reduce((obj, cur) => {
  obj[cur.mid] = {
    ...cur,
  };
  return obj;
}, {});

Date.prototype.format = function(format){
  var o = {
      "M+" : this.getMonth()+1, //month
      "d+" : this.getDate(), //day
      "h+" : this.getHours(), //hour
      "m+" : this.getMinutes(), //minute
      "s+" : this.getSeconds(), //second
      "q+" : Math.floor((this.getMonth()+3)/3), //quarter
      "S" : this.getMilliseconds() //millisecond
  }

  if(/(y+)/i.test(format)) {
      format = format.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));
  }

  for(var k in o) {
      if(new RegExp("("+ k +")").test(format)) {
          format = format.replace(RegExp.$1, RegExp.$1.length==1 ? o[k] : ("00"+ o[k]).substr((""+ o[k]).length));
      }
  }
  return format;
}


for (const post of stmt.iterate()) {
  const { cid, title, slug, created, text, type } = post;
  if (type !== 'post' || !text) {
    continue;
  }
  const metaIds = relationships[cid];
  const categories = [];
  const tags = [];
  if (metaIds) {
    metaIds.forEach((mid) => {
      const meta = metas[mid];
      switch (meta.type) {
        case 'category':
          if (meta.name !== 'Uncategorized') {
            categories.push(`- ${meta.name}`)
          }
          break;
        case 'tag':
          tags.push(`- ${meta.name}`)
          break;
        default:
      }
    });
  }
  const postMD =
`---
title: "${title}"
date: ${(new Date(created * 1000)).format("yyyy-MM-dd hh:mm:ss")}
categories:
${categories.join('\n')}
tags:
${tags.join('\n')}
---

${text.replace('<!--markdown-->', '')}
`
  const filePath = path.resolve(tmpFolder, `${slug}.md`);
  fs.writeFileSync(filePath, postMD);
}

