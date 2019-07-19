function now() {
  var d = new Date();

  var year = d.getFullYear();
  var month = (d.getMonth() + 1).toString().padStart(2, '0');
  var day = d.getDate().toString().padStart(2, '0');
  var hour = d.getHours().toString().padStart(2, '0');
  var minute = d.getMinutes().toString().padStart(2, '0');
  var second = d.getSeconds().toString().padStart(2, '0');


  return `${year}/${month}/${day}-${hour}.${minute}.${second}`;
}

exports.now = now;