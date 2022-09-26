/*
 * 诸葛晓 < 181-0191-5510 >
 * 2020-04-07
 * 工业互联网平台
 * zhuge.xiao@hhstech.com
 */
//------------------------------------------------------------------------------

const nano = require('nano')('http://iot:rel@localhost:5985');
const TimeUuid = require('../uuid/time-uuid');
const Uuid = require('../uuid/uuid');
const fs = require('fs');
//------------------------------------------------------------------------------

/**
 * 把相应的文件存入stage数据库
 */
//------------------------------------------------------------------------------

class Stage {
  static async create(options) {
    return new Stage(options);
  }

  constructor(options) {
    this.db = nano.db.use('stage');
  }
  //----------------------------------------------------------------------------

  // cn.json, en.json, ru.json
  async stage0() {
    const path = '/var/lib/swan/web/hhstech/app/js/i18n/';
    const files = fs.readdirSync('/var/lib/swan/web/hhstech/app/js/i18n/')
                    .filter((f) => {let a = f.split('.'); return a[a.length-1] === 'json';});

    for (let fname of files) {
      await this.insertAtt({id: 'hhstech:stage0', desc: 'locale json', ctype: 'text/plain', path: path, fname: fname});
    }

    // this.db.attachment.get('hhstech:stage0', 'cn.json').then((body) => {
    //   console.log(body);
    //   console.log(body.toString());
    //   fs.writeFileSync('/tmp/cn.json', body, (err) => {});
    // });

    return;
  }
  //----------------------------------------------------------------------------

  // locale.js
  async stage1() {
    const path = '/var/lib/swan/web/hhstech/app/js/i18n/';
    const fname = 'locale.js';
    await this.insertAtt({id: 'hhstech:stage1', desc: fname, ctype: 'text/plain', path: path, fname: fname});

    return;
  }
  //----------------------------------------------------------------------------

  // page_kit.js
  async stage2() {
    const path = '/var/lib/swan/web/hhstech/app/js/pagekit/';
    const fname = 'page_kit.js';
    await this.insertAtt({id: 'hhstech:stage2', desc: fname, ctype: 'text/plain', path: path, fname: fname});

    return;
  }
  //----------------------------------------------------------------------------

  // pre_page.js
  async stage3() {
    const path = '/var/lib/swan/web/hhstech/app/js/';
    const fname = 'pre_page.js';
    await this.insertAtt({id: 'hhstech:stage3', desc: fname, ctype: 'text/plain', path: path, fname: fname});

    return;
  }
  //----------------------------------------------------------------------------

  // login.js
  async stage4() {
    const path = '/var/lib/swan/web/hhstech/app/js/';
    const fname = 'login.js';
    await this.insertAtt({id: 'hhstech:stage4', desc: fname, ctype: 'text/plain', path: path, fname: fname});

    return;
  }
  //----------------------------------------------------------------------------

  // home.js
  async stage5() {
    const path = '/var/lib/swan/web/hhstech/app/js/';
    const fname = 'home.js';
    await this.insertAtt({id: 'hhstech:stage5', desc: fname, ctype: 'text/plain', path: path, fname: fname});

    return;
  }
  //----------------------------------------------------------------------------

  // f2f.js
  async stage6() {
    const path = '/var/lib/swan/web/hhstech/app/js/f2f/';
    const fname = 'f2f.js';
    await this.insertAtt({id: 'hhstech:stage6', desc: fname, ctype: 'text/plain', path: path, fname: fname});

    return;
  }
  //----------------------------------------------------------------------------

  // hhstech.js
  async stage7() {
    const path = '/var/lib/swan/web/hhstech/app/js/';
    const fname = 'hhstech.js';
    await this.insertAtt({id: 'hhstech:stage7', desc: fname, ctype: 'text/plain', path: path, fname: fname});

    return;
  }
  //----------------------------------------------------------------------------

  // locale.js
  async insertAtt({id, desc = '', ctype = 'text/plain', path, fname}) {
    if (!id || !path || !fname) {console.log('do nothing.'); return;}

    // let id = 'hhstech:stage0';
    let doc;
    try { doc = await this.db.get(id); } catch(e) {} // 第一次时，没有文档，会抛出 找不到
    if (!doc) {
      doc = { _id: id, desc: desc };
      let body = await this.db.insert(doc);
      doc._rev = body.rev;
    }
    console.log(doc);
    let data;
    try {data = fs.readFileSync(path + fname);} catch(e) {console.log('do nothing.'); return;}
    let ret = await this.db.attachment.insert(id, fname, data, ctype, { rev: doc._rev });
    console.log(ret);
    return ret;
  }
  //----------------------------------------------------------------------------

  // as stream
  async insertAttAsStream() {
    let ret = '';

    let path = '/tmp/';
    let fname = 't2.png';
    const rs = fs.createReadStream(path + fname);
    const db = nano.db.use('op');
    let id = 'user-public2-public2:ee72cd30-825a-11ea-920c-7bd7f301bf77';
    let rev = '2-6f85cce9b1b95ec4db5fd3a5da1f1b33';

    const is = db.attachment.insertAsStream(id, fname, null, 'image/png', { rev: rev })
      .on('data', (data) => {
        ret += data.toString()
      })
      .on('end', () => {
        console.log(ret);
      });

    rs.pipe(is);
  }
  //----------------------------------------------------------------------------

  async partitionedFind() {
    let partitionid = 'user-public5-public5';
    let query = {
      selector: {
        objid: 'public5',
        acc: 'public5'
        // $and: {
        //   // date: {
        //     //   $gt: '2018'
        //     // },
        //   }
        },
        // bookmark: 'g1AAAACieJzLYWBgYMpgSmHgKy5JLCrJTq2MT8lPzkzJBYpblhanFukWlCblZCabwmirNAsLMyPLZANdCzOTZF1Dw9REXYskM0Nd02RDIxOjtCQjw2RjkIEcMAMpMyoLAAESLrk',
        fields: ['_id', '_rev', 'acc'],
        limit: 1 // default 25
      }

    const db = nano.db.use('op');
    let ret = await db.partitionedFind(partitionid, query);
    console.log(ret);
    // {
    //   docs: [
    //     {
    //       _id: 'user-public5-public5:f88629c0-864c-11ea-8b61-5c1242fb21c3',
    //       _rev: '5-bc0cfed9ac52974a90c39590220c5f00',
    //       acc: 'public5'
    //     }
    //   ],
    //   bookmark:
    //   'g1AAAACieJzLYWBgYMpgSmHgKy5JLCrJTq2MT8lPzkzJBYpblhanFukWlCblZCabwmirNAsLMyPLZANdCzOTZF1Dw9REXYskM0Nd02RDIxOjtCQjw2RjkIEcMAMpMyoLAAESLrk',
    //   warning:
    //   'No matching index found, create an index to optimize query time.'
    // }
  }
  //----------------------------------------------------------------------------

  async partitionedFindAsStream() {
    let partitionid = 'user-public5-public5';
    let query = {
      selector: {
        objid: 'public5',
        acc: 'public5'
        // $and: {
        //   // date: {
        //     //   $gt: '2018'
        //     // },
        //   }
        },
        // bookmark: 'g1AAAACieJzLYWBgYMpgSmHgKy5JLCrJTq2MT8lPzkzJBYpblhanFukWlCblZCabwmirNAsLMyPLZANdCzOTZF1Dw9REXYskM0Nd02RDIxOjtCQjw2RjkIEcMAMpMyoLAAESLrk',
        fields: ['_id', '_rev', 'acc'],
        limit: 1 // default 25
      }

    const db = nano.db.use('op');
    let s = await db.partitionedFindAsStream(partitionid, query);
    let ret = '';
    s.on('data', (chunk) => {
      console.log(chunk);
      console.log(chunk.toString());
      ret += chunk.toString();
    });
    s.on('end', () => {
      console.log('end.');
      console.log(ret);
    });
    // {
    //   docs: [
    //     {
    //       _id: 'user-public5-public5:f88629c0-864c-11ea-8b61-5c1242fb21c3',
    //       _rev: '5-bc0cfed9ac52974a90c39590220c5f00',
    //       acc: 'public5'
    //     }
    //   ],
    //   bookmark:
    //   'g1AAAACieJzLYWBgYMpgSmHgKy5JLCrJTq2MT8lPzkzJBYpblhanFukWlCblZCabwmirNAsLMyPLZANdCzOTZF1Dw9REXYskM0Nd02RDIxOjtCQjw2RjkIEcMAMpMyoLAAESLrk',
    //   warning:
    //   'No matching index found, create an index to optimize query time.'
    // }
  }
  //----------------------------------------------------------------------------

}

async function run() {
  let stage = new Stage();
  await stage.stage0(); // cn.json, en.json
  // await stage.stage1(); // locale.js
  // await stage.stage2(); // page_kit.js
  // await stage.stage3(); // pre_page.js
  // await stage.stage4(); // login.js
  await stage.stage5(); // home.js
  await stage.stage6(); // f2f.js
  await stage.stage7(); // hhstech.js


  // await stage.insertAttAsStream(); // test as stream
  // await stage.partitionedFind(); // test partitionedFind
  // await stage.partitionedFindAsStream(); // test partitionedFind

  // // stage.db.attachment.getAsStream('hhstech:stage4', 'login.js').pipe(fs.createWriteStream('/tmp/login.js'));
  // let rs = stage.db.attachment.getAsStream('hhstech:stage4', 'login.js');
  // rs.on('open', () => {console.log('open');});
  // rs.on('data', (chunk) => {console.log(chunk);console.log(chunk.length);});
  // rs.on('end', () => {console.log('end');});
}
run();
//------------------------------------------------------------------------------
module.exports = Stage;
