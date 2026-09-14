
const TEACHER_EMAIL = 'engmohammedsaad8@gmail.com'; 
const SHEET_NAME = 'Submissions';
const DRIVE_ROOT_FOLDER = 'ملخصات الطلاب';

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['التاريخ', 'معتمد؟', 'الاسم', 'الموبايل', 'السنة', 'المادة', 'الدرس', 'رابط الملف', 'اسم الملف']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getRootFolder_() {
  const folders = DriveApp.getFoldersByName(DRIVE_ROOT_FOLDER);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(DRIVE_ROOT_FOLDER);
}
function getYearFolder_(year) {
  const root = getRootFolder_();
  const safeName = (year || 'غير محدد').toString();
  const folders = root.getFoldersByName(safeName);
  return folders.hasNext() ? folders.next() : root.createFolder(safeName);
}
function doPost(e) {
  try {
    let body = {};

    if (e.parameter && e.parameter.payload) {
      body = JSON.parse(e.parameter.payload);
    } else if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    if (body.action === 'upload') {
      return handleUpload_(body);
    }

    return jsonOut_({
      success: false,
      error: 'unknown action'
    });

  } catch (err) {
    return jsonOut_({
      success: false,
      error: String(err)
    });
  }
}
function handleUpload_(body) {
  const folder = getYearFolder_(body.year);
  const bytes = Utilities.base64Decode(body.fileData);
  const blob = Utilities.newBlob(bytes, body.mimeType, body.fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const sheet = getSheet_();
  const row = sheet.appendRow([
    new Date(), false, body.name, body.phone, body.year, body.subject, body.lesson,
    file.getUrl(), body.fileName
  ]).getLastRow();
  sheet.getRange(row, 2).insertCheckboxes(); // خانة "معتمد؟" تبقى checkbox

  if (TEACHER_EMAIL) {
    try {
      MailApp.sendEmail(
        TEACHER_EMAIL,
        'ملخص جديد يحتاج مراجعة - ' + body.subject,
        'الاسم: ' + body.name + '\n' +
        'الموبايل: ' + body.phone + '\n' +
        'السنة: ' + body.year + '\n' +
        'المادة: ' + body.subject + '\n' +
        'الدرس: ' + body.lesson + '\n' +
        'الملف: ' + file.getUrl() + '\n\n' +
        'وافق عليه من عمود "معتمد؟" في الشيت عشان يظهر للطلبة.'
      );
    } catch (mailErr) {
    }
  }

  return jsonOut_({ success: true });
}
function doGet(e) {
  if (e.parameter.action === 'list') return listApproved_();
  return jsonOut_({ success: false, error: 'unknown action' });
}
function listApproved_() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const items = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const approved = row[1];
    if (approved === true) {
      items.push({
        year: row[4],
        subject: row[5],
        lesson: row[6],
        fileUrl: row[7],
        fileName: row[8]
      });
    }
  }
  return jsonOut_({ success: true, items: items });
}
function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
