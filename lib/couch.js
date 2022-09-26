/*
 * 诸葛晓 < 181-0191-5510 >
 * 2020-04-08
 * 工业互联网平台
 * zhuge.xiao@hhstech.com
 */
//------------------------------------------------------------------------------

const nano = require('nano')('http://iot:rel@localhost:5985');
const TimeUuid = require('../uuid/time-uuid');
const Uuid = require('../uuid/uuid');
const fs = require('fs');
var stream = require('stream');
var Transform = stream.Transform;
const crypto = require('crypto');
//------------------------------------------------------------------------------

/**
 * 对 couch 数据处理
 */
//------------------------------------------------------------------------------

class Couch {
  static async create(options) {
    return new Couch(options);
  }

  constructor(options) {
    this.db = nano.db.use('op'); // op, OpenPrice
  }
  //----------------------------------------------------------------------------

  // 更改口令
  // 先验证旧口令，然后更改为新口令
  // @param {JSON} data - {a: 'someaction', p: {_id: '', oldp: '', newp: '', token: ''}}
  // @return {JSON|String} - {ok: true, id: '', rev: ''}|''
  async chgpwd(data) {
    if (!data.p.oldp || !data.p.newp) return '';

    let doc;
    try { doc = await this.db.get(data.p._id); } catch(e) {} // 可能没有文档，会抛出 找不到
    if (!doc) return '';

    if (data.p.oldp !== this.decrypt(doc.en_p)) return '';
    if (data.p.oldp === data.p.newp)
    return ({id: doc._id, rev: doc._rev, '：／～！／：': doc.en_p});

    doc.en_p = this.encrypt(data.p.newp);
    let body = await this.db.insert(doc);
    return ({id: body.id, rev: body.rev, '：／～！／：': doc.en_p});
  }
  //----------------------------------------------------------------------------

  // 删除帐户
  // 先复制成删除文档，然后删除
  // @param {JSON} data - {a: 'someaction', p: {_id: '', token: ''}}
  // @return {Boolean} - true|false
  async rmAcc(data) {
    let doc;
    try { doc = await this.db.get(data.p._id); } catch(e) {} // 可能没有文档，会抛出 找不到
    if (!doc) return '';

    await this.db.copy(data.p._id, 'deleted_' + data.p._id, { overwrite: true });

    let ret = await this.db.destroy(doc._id, doc._rev);

    return ret;
  }
  //----------------------------------------------------------------------------

  // 核验令牌 token
  // 如果 _id, token 与最近一次生成的匹配，返回 true ，否则返回 false
  // @param {JSON} data - {a: 'someaction', p: {token: ''}}
  // @return {Boolean} - true|false
  async synUser(data) {
    if (!data.p.token) return false;
    let token = this.decrypt(data.p.token);
    let id = token.split('#')[0]; // _id + '#' + docid
    let doc;
    try { doc = await this.db.get(id); } catch(e) {} // 可能没有文档，会抛出 找不到
    let transform = this.createTransform({bors: false, enc: 'base64'});
    let attname = 'avator.png';
    let rs = await this.db.attachment.getAsStream(id, attname);
    rs.pipe(transform).pipe(data.p.stream2);

    return doc;
  }
  //----------------------------------------------------------------------------

  // 核验令牌 token
  // 如果 _id, token 与最近一次生成的匹配，返回 true ，否则返回 false
  // @param {JSON} data - {a: 'someaction', p: {token: ''}}
  // @return {Boolean} - true|false
  async validToken(data) {
    if (!data.p.token) return false;
    let token = this.decrypt(data.p.token);
    let id = token.split('#')[0]; // _id + '#' + docid
    let doc;
    try { doc = await this.db.get(id); } catch(e) {return false;} // 可能没有文档，会抛出 找不到
    if (!doc) return false;
    if (data.p.token === doc.token) return true;
    else return false;
  }
  //----------------------------------------------------------------------------

  // 登录 或 自动登录时，生成访问令牌 token
  // home.js 里用到
  // login.js 也用到 genToken action 但，有可能没有 _id
  // @param {JSON} data - {a: 'genToken', p: {_id: '', acc: '', org: '', '：／～！／：': '', p:''}}
  // @return {JSON} - {id: '', token: ''}
  async genToken(data) {
    let doc;
    if (data.p._id) {
      // 有 _id , 直接找到文档
      try { doc = await this.db.get(data.p._id); } catch(e) {}
    }
    else {
      if (!data.p.acc) return ({token: ''}); // 如果没有 _id, 则必须有 acc
      if (!data.p.p) return ({token: ''});

      // 没有 _id
      let at = data.p.acc.split('@'); // 是客户端的 lastlogin 的 acc 传递来的
      // 注册的 id 是 acc 在 @ 字符拆开的，而保存在客户端的 lastlogin 的 acc 是没拆的
      let partitionid = 'user-' + (at[1] || at[0]) + '-' + at[0];
      let query = {
        selector: {
          objid: at[0],
          acc: at[0] // 注册的 id 是 acc 在 @ 字符拆开的，而保存在客户端的 lastlogin 的 acc 是没拆的
        },
        // fields: ['_id', '_rev', 'acc', 'en_p', 'orgs'], // 生成 token 后，要写回去，所以，不指定 fields
        limit: 1 // default 25
      }
      let ret = await this.db.partitionedFind(partitionid, query);
      if (ret && ret.docs[0]) doc = ret.docs[0];
    }

    if (!doc) return ({token: ''});

    // data.p.p 是未加密的
    if ( doc.en_p !== ( data.p._id ? data.p['：／～！／：'] : this.encrypt(data.p.p) ) ) return ({token: ''});

    if (data.p.org) {
      let has = false;
      // orgs 是JSON数组 - [{objid:'', name:''}]
      if (doc.orgs) {
        for (let e of doc.orgs) {
          if (e.objid === data.p.org) {
            // 有所在组织
            has = true;
            break;
          }
        }
      }
      else {
        // 如果没有所在组织，则，为自己的组织
        let at = data.p.acc.split('@');
        has = data.p.org === (at[1] || at[0]);
      }

      if (!has) return ({token: ''}); // 既不是自己的组织，又不在归属组织里
    }

    // token - 用于控制访问，每次登录时生成
    let token = this.encrypt(doc._id + '#' + TimeUuid.now().toString());
    doc.token = token;
    let body = await this.db.insert(doc);
    let ret = {id: body.id, rev: body.rev, token: token};
    if (doc.orgs) ret.orgs = doc.orgs;
    return ret;
  }
  //----------------------------------------------------------------------------

  // 注册帐号
  // 如果 data.p._id 不存在，则组织 _id ，并增加一条，否则，更新
  // 注册的第一步，没有 _id, 只有 acc p (passwd)
  // @param {JSON} data - {a: 'chkrgstacc', p: {acc: '', p: ''}}
  // @return {JSON} - {id: '', rev: ''}
  async rgstAcc(data) {
    // user = {
    //   _id: 'user-hhstech-acc:timeuuid', // 'cf-which-objid:docid'
    //   objid: 'acc', // 帐号 - 由于是国际化，具有多国语言，且对象的属性或者域是动态任意增加的，因此，用 objid 代表帐号
    //   '帐号': 'acc',
    //   '姓名': '',
    // }

    // // 由客户端处理了
    // data.p.acc = data.p.acc.replace(/ /g,'').toLowerCase();
    // data.p.acc = data.p.acc.replace(/ /g,''); // ' '  is not blank space, its charCodeAt is 8198, unprintable

    data.p._id = data.p._id || data.p.id; delete data.p.id; // 只留 _id

    // 新建文档
    if (! data.p._id) {
      let at = data.p.acc.split('@');
      // 注册的 id 是 acc 在 @ 字符拆开的，而保存在客户端的 lastlogin 的 acc 是没拆的
      let partitionid = 'user-' + (at[1] || at[0]) + '-' + at[0];
      let docid = TimeUuid.now().toString();

      data.p._id = partitionid + ':' + docid;

      // token - 用于控制访问，每次登录时生成；注册后，也算是登录
      let token = this.encrypt(data.p._id + '#' + docid);

      data.p.en_p = this.encrypt(data.p.p) // 加密
      data.p.acc = at[0]; // acc 截掉了 @
      data.p.objid = at[0]; // 用objid代表帐号
      data.p.token = token;
      let body = await this.db.insert(data.p);
      return ({id: body.id, rev: body.rev, '：／～！／：': data.p.en_p, token: token});
    }
    // 更新原有文档
    else {
      // 可能存在，找到后，更新
      let doc;
      try { doc = await this.db.get(data.p._id); } catch(e) {} // 可能没有文档，会抛出 找不到
      if (!doc) return {};
      // data.p._rev = doc._rev; // 传递进来的 rev，不准确，所以重新找到覆盖

      // 图片
      if (data.p.is_att) {
        let transform = this.createTransform({bors: true, enc: 'base64'});
        data.p.stream2.pipe(transform);

        // transform.on('end', async (chunk) => {
        //   console.log('transform end.......');
        // });

        // const ws = fs.createWriteStream('/tmp/t3.png');
        // transform.pipe(ws);

        let body = {};
        // const is = this.db.attachment.insertAsStream(id, fname, null, 'image/png', { rev: rev })
        // NOTE: insertAsStream -- document file name 不能是中文，否则，抛出异常
        const is = this.db.attachment.insertAsStream(doc._id, data.p.filename, null, data.p.filetype, { rev: doc._rev })
          .on('data', (chunk) => {
            // chunk is Buffer of String of JSON
            // console.log(chunk.toString());
            body = JSON.parse(chunk.toString());
          })
          .on('end', () => {
            // 可以重新获取 rev ，然后返回
            // console.log('att done');
            return ({id: body.id, rev: body.rev});
          });

        // rs.pipe(is);
        transform.pipe(is);

        let content_length = 0;
        data.p.stream2.on('data', async (chunk) => {
        	content_length += chunk.length;
        	if (content_length >= data.p.content_length) {
        		data.p.stream3.write('end'); // 通知客户端数据结束完毕，可以关闭流
        	}
        });

        data.p.stream2.on('end', async (chunk) => {
          transform.end(); // 一定要执行 end() 结束流，否则，insertAsStream() 延时，导致 timeout
          // console.log('transform end2 .......');
          data.p.stream3.end('finish');
        });

        data.p.stream3.write('ready'); // 通知客户端已准备

        // const rs = fs.createReadStream('/tmp/t2.png');
        // console.log(data.p._id, data.p.filename, data.p.filetype);
        // const ws = this.db.attachment.insertAsStream(doc._id, data.p.filename, null, data.p.filetype,
        // { rev: doc._rev }).on('end', () => {
        //   console.log(data.p.filename, ' att done');
        // });
        // console.log(data.p);
        // rs.pipe(ws);
      }

      else {
        let body = await this.db.insert(Object.assign({}, doc, data.p));
        return ({id: body.id, rev: body.rev});
      }

    }
  }
  //----------------------------------------------------------------------------

  // 检查注册帐号是否存在
  // @param {JSON} data - {a: 'chkrgstacc', p: {acc: ''}}
  // @return {String|JSON} - 'EXIST' | {id: '', rev: ''}
  async chkrgstacc(data) {
    // user = {
    //   _id: 'user-hhstech-acc:timeuuid', // 'cf-which-objid:docid'
    //   objid: 'acc', // 帐号 - 由于是国际化，具有多国语言，且对象的属性或者域是动态任意增加的，因此，用 objid 代表帐号
    //   '帐号': 'acc',
    //   '姓名': '',
    // }
    if (! data) return 'EXIST';

    data.p.acc = data.p.acc.replace(/ /g,'').toLowerCase();
    data.p.acc = data.p.acc.replace(/ /g,''); // ' '  is not blank space, its charCodeAt is 8198, unprintable
    if (! data.p.acc) return 'EXIST';

    if (
      data.p.acc.match(/hhstech/i) || data.p.acc.match(/loohool/i) ||
      data.p.acc.match(/foomoo/i) || data.p.acc.match(/accumulo/i) || data.p.acc.match(/zhugexiao/i)
    ) {
      return 'EXIST';
    }

    let at = data.p.acc.split('@');
    let d = at[1] || at[0];

    if (at[0] === 'zhuge') return 'EXIST';
    if (d === 'zhuge') return 'EXIST';

    let n = ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
    let c = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj', 'kk',
             'll', 'mm', 'nn', 'oo', 'pp', 'qq', 'rr', 'ss', 'tt', 'uu', 'vv', 'ww', 'xx', 'yy', 'zz'];
    // 不允许连续叠号
    for (let i = 0; i < n.length; i++) {
      for (let j = 0; j < n.length; j++) {
        if (d.match(n[i] + n[j])) return 'EXIST';
        if (at[0].match(n[i] + n[j])) return 'EXIST';
      }
    }
    for (let i = 0; i < c.length; i++) {
      for (let j = 0; j < c.length; j++) {
        if (d.match(n[i] + n[j])) return 'EXIST';
        if (at[0].match(n[i] + n[j])) return 'EXIST';
      }
    }

    let partitionid = 'user-' + d + '-' + at[0];
    let rs = await this.db.partitionedList(partitionid, { limit: 1 }); // limit 1 - 只要有一条，就说明存在
    return rs;
    // let transform = this.createTransform();
    // let rs = await this.db.partitionedListAsStream(partitionid, { limit: 1 }); // limit 1 - 只要有一条，就说明存在
    // return rs.pipe(transform);
  }
  //----------------------------------------------------------------------------

  // 从stage拉取相应的文件：cn.json, en.json, locale.js, pre_page.js, login.js, home.js ...
  // 返回一个转换后的流
  // @param {JSON} data - {a: 'stage0', p: {which: '', locale: 'cn'}}
  // @return {stream}
  async stage(data) {
    // ⚠️注意：这里的 db ，不是 this.db 否则可能找不到数据
    let db = nano.db.use('stage');

    let transform = this.createTransform();

    if (data.p.locale === 'zh') data.p.locale = 'cn'
    // // 本地化文件
    // let file = '/var/lib/swan/web/' + (data.p.which || 'hhstech') + '/app/js/i18n/' + data.p.locale + '.json';
    // switch (data.a) {
    // 	case 'stage3':
    // 		file = '/var/lib/swan/web/' + (data.p.which || 'hhstech') + '/app/js/login.js';
    // 		break;
    // 	case 'stage2':
    // 		file = '/var/lib/swan/web/' + (data.p.which || 'hhstech') + '/app/js/pagekit/page_kit.js';
    // 		break;
    // 	case 'stage1':
    // 		file = '/var/lib/swan/web/' + (data.p.which || 'hhstech') + '/app/js/i18n/locale.js';
    // 		break;
    // 	default:
    //
    // }
    // let rs = fs.createReadStream(file, {encoding: 'utf8'}); // text

    let docid = (data.p.which || 'hhstech') + ':' + data.a;
    let attname = data.p.locale + '.json'; // stage0

    switch (data.a) {
      case 'stage7':
        attname = 'hhstech.js';
        break;

      case 'stage6':
        attname = 'f2f.js';
        break;

      case 'stage5':
        attname = 'home.js';
        break;

      case 'stage4':
        attname = 'login.js';
        break;

      case 'stage3':
        attname = 'pre_page.js';
        break;

      case 'stage2':
        attname = 'page_kit.js';
        break;

      case 'stage1':
        attname = 'locale.js';
        break;

      default:
    }

    let doc = await db.get(docid); // doc 已存在的 (通过 node stage.js 插入文档, see stage.js)
    // try { doc = await db.get(docid); } catch(e) {console.log(e);}
    if (data.p.ver && doc._rev === data.p.ver) {return ''} // 版本相同，不需更新
    if (data.p.stream2) {data.p.stream2.write({ver: doc._rev})}

    // db.attachment.getAsStream(docid, attname).pipe(fs.createWriteStream('/tmp/login.js'));
    let rs = await db.attachment.getAsStream(docid, attname);

    // // rs.on('readable', () => {
    //   // 	let data;
    //   // 	// if (len + 10240 > file_size) size = file_size - len;
    //   // 	while (data = rs.read(size)) {
    //     // 		stream.write(data);
    //     // 		// len += data.length;
    //     // 	}
    //     // });
    // rs.on('end', () => {stream.end()});
    // // rs.setEncoding();
    // // rs.on('data', (chunk) => {console.log(chunk);console.log(chunk.length);});
    // // rs.on('error', (error) => {console.log(error);});
    //
    // // rs.pipe(stream);
    // rs.pipe(transform).pipe(stream);
    // // rs.on('open', () => {
    // // 	rs.pipe(stream);
    // // });

    return rs.pipe(transform);
  }
  //----------------------------------------------------------------------------

  // @param {Boolean} bors - Buffer or String, 转换成 Buffer 还是 String
  // @param {String} enc - 转换编码, 如 'base64', 'utf8', 'hex'
  createTransform({bors = false, enc = ''} = {}) {
    return new Transform({
      readableObjectMode: true,
      writableObjectMode: true,
      transform(chunk, encoding, callback) {
        // Transform the chunk into something else
        let item = chunk;
        if (bors) {
          if (enc) item = Buffer.from(chunk, enc);
          else item = Buffer.from(chunk);
        } else {
          if (enc) item = chunk.toString(enc);
          else item = chunk.toString();
        }
        callback(null, item);
      }
    });
  }
  //----------------------------------------------------------------------------

  encrypt(text) {
    let password = ' OpenPrice.cn三产融合委员会-诸葛晓 ';
    var cipher = crypto.createCipher('aes-256-cbc', password);
    var crypted = cipher.update(text, 'utf8', 'base64');
    return crypted + cipher.final('base64');
  }
  //----------------------------------------------------------------------------

  decrypt(text) {
    let password = ' OpenPrice.cn三产融合委员会-诸葛晓 ';
    var decipher = crypto.createDecipher('aes-256-cbc', password);
    var dec = decipher.update(text, 'base64', 'utf8');
    return dec + decipher.final('utf8');
  }
  //----------------------------------------------------------------------------

}
//------------------------------------------------------------------------------
// // base64 字符串 写入文件的方式
// var image = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAA..kJggg==';
// let f = `${process.env.HOME}/web/att/file` ; // + (store_files[z].indexOf('/') !== -1 ? ('.' + store_files[z].split('/')[1]) : (store_files[z].indexOf('pdf') !== -1 ? '.pdf' : ''));
// fs.open(f, 'w', (err, fd) => {
//   if (err) return;
//
//   let matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
//   let base64 = {};
//
//   if (matches.length !== 3) {
//     return new Error('Invalid input string');
//   }
//
//   base64.type = matches[1];
//   base64.data = Buffer.from(matches[2], 'base64');
//
//   fs.write(fd, base64.data, (err, bytes, buf) => {
//     fs.close(fd, (err) => {});
//   });
//
// });
//
// fs.writeFile('test.jpg', base64.data, function(err) { ... });
//
// var image = 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAA..kJggg==';
//
// var data = image.replace(/^data:image\/\w+;base64,/, '');
//
// var data = image.split(",")[1];// split with `,`
//
// fs.writeFile(fileName, data, {encoding: 'base64'}, function(err){
//   //Finished
// });
//------------------------------------------------------------------------------
module.exports = Couch;
