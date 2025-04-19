const sql = require("mssql/msnodesqlv8");
var config = {
    server: "localhost",
    database: "BikeStores",
    driver: "msnodesqlv8",
    user: "sa",
    password: "12345678",
    options: {
        trustedConnection: true
    }
}
sql.connect(config, function (err) {
    if (err) console.log(err);
    var request = new sql.Request();
    request.query("select * from sales.orders", function (err, recordset) {
        if (err) console.log(err)
        console.log(recordset);
    });
});