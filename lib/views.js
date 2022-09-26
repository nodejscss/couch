/*
 * 诸葛晓 < 181-0191-5510 >
 * 2020-04-10
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
 * views 设计文档
 */
//------------------------------------------------------------------------------

class Views {
  static async create(options) {
    return new Views(options);
  }

  constructor(options) {
    this.db = nano.db.use('op');
  }
  //----------------------------------------------------------------------------

  // user document
  async user() {
    const by_acc = function(doc) {
      if (doc.objid) {
        emit(doc.objid, doc.weight)
      }
    }

    // Design Document
    const ddoc = {
      _id: '_design/user-ddoc',
      views: {
        by_acc: {
          map: by_acc.toString(),
          // reduce: '_sum'
        }
      },
      options: {
        partitioned: true
      }
    }

    // create design document
    let doc;
    try { doc = await this.db.get(ddoc._id); } catch(e) {} // 第一次时，没有文档，会抛出 找不到
    if (!doc) doc = {};
    doc = Object.assign({}, doc, ddoc);

    let ret = await this.db.insert(doc)

    console.log(ret);

    return ret;
  }
  //----------------------------------------------------------------------------

}

async function run() {
  let views = new Views();
  await views.user();
}
run();
//------------------------------------------------------------------------------
module.exports = Views;
