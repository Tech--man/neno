import { settingStrore } from "../store/store.js";
import { getObjectId } from "../utils/objetid.js";
import { getObjectURL } from "../utils/process.js";
import { openDB, deleteDB, wrap, unwrap } from 'idb';
import dayjs from "dayjs";

// import { openDB } from 'idb/with-async-ittr.js';
let baseurl = ""
let offlineModel = false
const db = openDB("neno", 3, {
    upgrade(db, oldVersion, newVersion, transaction) {
        console.log('数据库新建成功');

        db = event.target.result;
        var objectStore;
        if (!db.objectStoreNames.contains('nenoitem')) {
            objectStore = db.createObjectStore('nenoitem', { keyPath: '_id' });
            objectStore.createIndex('_id', '_id', { unique: true });// 创建索引
            objectStore.createIndex('parentId', 'parentId', { unique: false });// 创建索引

            objectStore = db.createObjectStore('nenoPic', { keyPath: '_id' });
            objectStore.createIndex('_id', '_id', { unique: true });

            objectStore = db.createObjectStore('nenoCount', { keyPath: '_id' });
            objectStore.createIndex('_id', '_id', { unique: false });


            objectStore = db.createObjectStore('nenoPinTags', { keyPath: '_id' });
        }
    },
})

settingStrore.subscribe(value => {

    baseurl = value.domain;
    offlineModel = value.offlineModel
});
// const baseurl = "http://127.0.0.1:3000"
// const baseurl = "https://b9c21f2efdc44e2792d2ac7cbb8feff4.apig.cn-north-4.huaweicloudapis.com"
// const baseurl = "https://fmolo.bijiduo.com"
function genergeParams(data) {
    return {
        body: JSON.stringify(data),
        method: "post",
        headers: {
            'content-type': 'application/json'
        },
        mode: "cors",
    }

}
const readUploadedFileAsText = (inputFile) => {
    const temporaryFileReader = new FileReader();

    return new Promise((resolve, reject) => {
        temporaryFileReader.onerror = () => {
            temporaryFileReader.abort();
            reject(new DOMException("Problem parsing input file."));
        };

        temporaryFileReader.onload = (e) => {
            resolve(e.target.result);
        };
        temporaryFileReader.readAsDataURL(inputFile);
    });
};
export const exportIndexedDB = async (key) => {
    let allNeno = await (await db).getAll("nenoitem")
    let allNenoCount = await (await db).getAll("nenoCount")
    let allNenoPinTags = await (await db).getAll("nenoPinTags")
    let allNenoPic = await (await db).getAll("nenoPic")
    let allNenopicBase64 = []
    for (const element of allNenoPic) {
        var blob = element.file;
        let picbase64 = await readUploadedFileAsText(blob)
        console.log(picbase64);
        allNenopicBase64 = [...allNenopicBase64, { _id: element._id, file: picbase64 }]
    }



    return new Promise((resolve, rej) => {
        return resolve({
            body: {
                allNeno: allNeno,
                allNenoCount: allNenoCount,
                allNenoPinTags: allNenoPinTags,
                allNenoPic: allNenopicBase64,

            }
        })

    })

}
export const importIndexedDB = async (allData) => {
    let allNeno = await (await db).getAll("nenoitem")

    let allNenoCount = await (await db).getAll("nenoCount")
    let allNenoPinTags = await (await db).getAll("nenoPinTags")
    allData.allNeno.forEach(async (element) => {
        let re = await (await db).put('nenoitem', element);
        console.log("  allData.allNeno", re, element);
    });
    allData.allNenoCount.forEach(async (element) => {
        let re = await (await db).put('nenoCount', element);
        console.log("  allData.allNenoCount", re, element);

    });
    allData.allNenoPinTags.forEach(async (element) => {
        let re = await (await db).put('nenoPinTags', element);
        console.log("  allData.allNenoPinTags", re, element);

    });


    allData.allNenoPic.forEach(async (element) => {
        let file=await (await fetch(element.file)).blob()
        element.file=file
        let re = await (await db).put('nenoPic', element);
        console.log("  allData.allNenoPic", re, element);

    });
    return new Promise((resolve, rej) => {
        return resolve({
            body: {
                allNeno: allNeno,
                allNenoCount: allNenoCount,
                allNenoPinTags: allNenoPinTags,
            }
        })

    })

}
export const getFileFromIndexedDB = async (key) => {
    let result = await (await db).get("nenoPic", key)
    return new Promise((resolve, rej) => {
        var url = getObjectURL(result.file)
        return resolve({ key: url })

    })
}
export const uploadPicIndexedDB = async (imageFile) => {
    var _id = getObjectId().toString()

    await (await db).put("nenoPic", { _id: _id, file: imageFile })

    return new Promise((resolve, rej) => {
        return resolve({ key: _id })
    })
}
export const getAllFmolo = async (data) => {
    if (offlineModel) {


        // console.log(aa);
        var nenos = []
        var count = 0;
        var pageing = 0;
        let cursor = await (await db).transaction("nenoitem").store.openCursor(null, "prev");

        while ((cursor)) {

            if (data.page != 0 && pageing == 0) {
                cursor = await (cursor).advance(data.page * 20 + 1)
                pageing = 1
            } else {
                let value = cursor.value;
                nenos = [...nenos, value]
                if (++count > 20) {
                    return new Promise((resolve, rej) => {
                        return resolve({ body: nenos })

                    })

                }

                cursor = await cursor.continue();
            }
        }
        return new Promise((resolve, rej) => {
            return resolve({ body: nenos })

        })


    } else
        return await (await fetch(`${baseurl}/find`, genergeParams(data))).json()
}

export const addFmolo = async (data) => {
    if (offlineModel) {
        data._id = getObjectId().toString()
        data.created_at = dayjs().format()
        await (await db).put('nenoitem', data);
        let dDate = data.created_at.substring(0, 10)
        // let dDate="2021-03-27"
        let countDate = {}

        let cursor = await (await db).transaction("nenoCount").store.openCursor();

        if (cursor) {
            countDate = cursor.value
            if (countDate[dDate]) {
                countDate[dDate] += 1
            } else {
                countDate[dDate] = 1
            }
            await (await db).put('nenoCount', countDate);
        } else {
            countDate._id = getObjectId().toString()
            countDate[dDate] = 1
            await (await db).put('nenoCount', countDate);

        }
        return new Promise(async (resolve, rej) => {

            return resolve({ body: data })

        })

    } else {
        return await (await fetch(`${baseurl}/addNeno`, genergeParams(data))).json()
    }

}
export const detail = async (data) => {
    if (offlineModel) {
        var result = await (await db).getFromIndex('nenoitem', "_id", data._id);
        //查找父item
        if (result.parentId != "") {
            var presult = await (await db).getFromIndex('nenoitem', "_id", result.parentId);
            result.parent = presult
        }
        var children = []

        var cresult = await (await db).getAllFromIndex('nenoitem', "parentId", result._id);

        for (let index = 0; index < cresult.length; index++) {
            var element = cresult[index];


            var gcresult = await (await db).getAllFromIndex('nenoitem', "parentId", element._id);
            element.children = gcresult

            children = [...children, element]
        }
        result.children = children
        return new Promise(async (resolve, rej) => {
            ('return: ', result);
            return resolve({ body: result })
        })
    } else {
        return await (await fetch(`${baseurl}/detail`, genergeParams(data))).json()
    }
}
export const deleteOne = async (data) => {
    if (offlineModel) {
        (await db).delete('nenoitem', data._id);
        return new Promise(async (resolve, rej) => {
            return resolve({ body: {}, code: 200 })
        })
    } else {
        return await (await fetch(`${baseurl}/delete`, genergeParams(data))).json()

    }
}
export const tags = async (data) => {

    if (offlineModel) {
        let tags = new Set()

        let cursor = await (await db).transaction("nenoitem").store.openCursor();
        while (cursor) {
            let neno = cursor.value
            neno.tags.forEach(element => {
                tags.add(element)
            });
            cursor = await cursor.continue()
        }
        return new Promise(async (resolve, rej) => {
            return resolve({
                code: 200,
                message: "BIU",
                body: [...tags]
            })
        })
    } else {
        return await (await fetch(`${baseurl}/tags`, genergeParams(data))).json()
    }
}
export const pin = async (data) => {
    if (offlineModel) {
        let pinTags = {}

        let cursor = await (await db).transaction("nenoPinTags").store.openCursor();
        if (cursor) {
            pinTags = cursor.value
            pinTags.tags = new Set(pinTags.tags)
        } else {
            pinTags._id = getObjectId().toString()
            pinTags.tags = new Set()
        }
        if (pinTags.tags.has(data.tag)) {
            pinTags.tags.delete(data.tag)
        } else {
            pinTags.tags.add(data.tag)
        }

        pinTags.tags = [...pinTags.tags]
        await (await db).put('nenoPinTags', pinTags);
        return new Promise(async (resolve, rej) => {
            return resolve({
                code: 200,
                message: "BIU",
                body: [...pinTags.tags]
            })
        })
    } else {
        return await (await fetch(`${baseurl}/pin`, genergeParams(data))).json()
    }
}
export const pins = async (data) => {
    if (offlineModel) {
        let pinTags = []
        let cursor = await (await db).transaction("nenoPinTags").store.openCursor();
        if (cursor) {
            pinTags = cursor.value.tags
        }
        let repintags = []
        pinTags.forEach(element => {
            repintags = [...repintags, { _id: getObjectId().toString(), tag: element }]
        });
        return new Promise(async (resolve, rej) => {
            return resolve({
                code: 200,
                message: "BIU",
                body: [...repintags]
            })
        })
    } else {
        return await (await fetch(`${baseurl}/pins`, genergeParams(data))).json()
    }
}
export const search = (data) => {
    return fetch(`${baseurl}/search`, genergeParams(data))
}
export const qiniuToken = (data) => {
    return fetch(`${baseurl}/qiniu`, genergeParams(data))
}
export const setting = (data) => {
    return fetch(`${baseurl}/setting`, genergeParams(data))
}
export const count = async (data) => {
    if (offlineModel) {
        let cursor = await (await db).transaction("nenoCount").store.openCursor();
        let countDate = {}
        if (cursor) {
            countDate = cursor.value
        }
        let count = await (await db).countFromIndex("nenoitem", "_id")
        return new Promise(async (resolve, rej) => {
            return resolve({ body: { countDate: countDate, count: count } })

        })
    } else {

        return await (await fetch(`${baseurl}/count`, genergeParams(data))).json()
    }
}
export const rename = async (data) => {

    if (offlineModel) {

        let cursor = await (await db).transaction("nenoitem", "readwrite").store.openCursor();
        while (cursor) {
            console.log(cursor.key, cursor.value);
            let neno = cursor.value
            for (let index = 0; index < neno.tags.length; index++) {
                const element = neno.tags[index];
                if (element == data.oldTag) {
                    let element = neno;
                    let rawContent = element.content
                    let pIndex = 0;
                    let pContent = ""
                    for (let tindex = 0; tindex < element.tags.length; tindex++) {
                        let rawtag = element.tags[tindex];

                        if (rawtag == data.oldTag) {
                            let breakIndex = rawContent.indexOf(rawtag);

                            element.tags[tindex] = data.newTag
                            //截取前段的字符
                            pContent += rawContent.substring(0, breakIndex);
                            //加上替换的内容
                            pContent += data.newTag
                            pIndex += breakIndex + data.oldTag.length;
                            rawContent = rawContent.substring(breakIndex + data.oldTag.length);

                        } else {
                            let breakIndex = rawContent.indexOf(rawtag);
                            pContent += rawContent.substring(0, breakIndex + rawtag.length);

                            rawContent = rawContent.substring(breakIndex + rawtag.length);
                            pIndex += breakIndex + rawtag.length;

                        }
                    }
                    pContent += element.content.substring(pIndex);
                    element.content = pContent
                    cursor.update(neno)
                    break
                }
            }


            cursor = await cursor.continue()
        }
        return new Promise(async (resolve, rej) => {
            return resolve({
                code: 200,
                message: "BIU",
                body: {}
            })
        })
    } else {

        return await (await fetch(`${baseurl}/rename`, genergeParams(data))).json()
    }
}






