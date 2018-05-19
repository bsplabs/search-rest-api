const express = require('express')
const mysql = require('mysql')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());


// แก้ไขปัญหาเมื่อมีการเชื่อม DB หลายๆครั้ง
var pool      =    mysql.createPool({
     connectionLimit : 100,
     host     : 'localhost',
     user     : 'root',
     password : '',
     database : 'property_data',
     debug    :  false
 });

 function handle_database(req,res,sql)
 {
     pool.getConnection(function(err,connection)
     {
         if (err)
         {
           // ถ้าไม่เปิดการเชื่อมต่อ DB Sever จะเกิด Error ตรงนี้
           // ตอนที่ผู้เขียนทดสอบ ใช้ WAMP Server ในการเปิดปิด service ที่เกี่ยวข้องเหล่านี้
           connection.release();
           res.json({"code" : 100, "status" : "Error in connection database"});
           return;
         }

         console.log('connected as id ' + connection.threadId);

         connection.query(sql,function(err,rows)
         {
           connection.release();
           if(!err)
           {
               res.json(rows);
           }
         });

         connection.on('error', function(err)
         {
           res.json({"code" : 100, "status" : "Error in connection database"});
           return;
         });
   });
 }


 app.get("/",function(req,res){-
         res.send("Hello <br> GET API With /api/?.....")
 });


 app.get("/api/", function(req,res){

     // แปลง Object ของ Query string ให้เป็น Array
     var k = Object.keys(req.query)
     var v = Object.values(req.query)

     var lr = false;  // เช็คเมื่อเจอ parameter ที่เป็น Location และ Radius
     var rd = 0;
     var checkWhere = false; // สำหรับเช็คการต่อคำสั่ง FROM properties WHERE ให้กับ sql

     // กำหนดค่าเริ่มต้นสำหรับคำสั่ง SQL
     var sql = "SELECT * ";
     var And = " AND "

     var i;
     for(i = 0 ; i < k.length ; i++)
     {

       // ตัวแปร arr คือค่า Location {lat,long} ของเรา
       // จะค้นหาเฉพาะ url ->  /api/?location=12.2,1223&radius=x;
       // arr[0] --> lat , arr[1] --> long
       if (k[i] == "location" && k[i+1] == "radius")
       {
         var arr = v[i].split(",")
         sql += ", (3959 *acos(cos(radians(" + arr[0] + ")) * cos(radians(latitude)) * cos(radians(longitude) - radians(" + arr[1] + ")) + sin(radians(" + arr[0] + ")) * sin(radians(latitude)))) AS `distance` ";
         lr = true;
         rd = v[i+1]; //เก็บค่ารัศรอบ เพื่อใช้ดึงข้อมูลโรงเเรม ที่อยู่ในรัศมีที่กำหนดมาใน url query

         // ลบอาเรย์ที่เจอออกไป เพราะว่า เราได้เซตคำสั่ง sql ให้กับตัว location กับ radius เเล้ว
         k.splice(i, 2);
         v.splice(i, 2);
       }
     }

     for(i = 0 ; i < k.length ; i++)
     {
       if (lr == true && (k[i] == "location" || k[i] == "radius"))
        {
         continue;
       }
       // ถ้าเป็นชุด query สุดท้าย ไม่ต้องเติม AND ต่อท้ายมัน
      if(i == (k.length-1))
      {
        And = ""
      }

       if (k[i] == "room_price")
       {
         if(checkWhere)
         {
           var arr = v[i].split("-")
           sql += " (" + k[i] + " BETWEEN " + arr[0] + " AND " + arr[1] + ")" + And
         }
         else
         {
           var arr = v[i].split("-")
           sql +=  " FROM properties WHERE (" + k[i] + " BETWEEN " + arr[0] + " AND " + arr[1] + ") " + And
           checkWhere = true;
         }
       }
       else
       {
         if(checkWhere)
         {
           sql += " (" + k[i] + " = \'" + v[i] + "\') " + And
         }
         else
         {
           sql += " FROM properties WHERE (" + k[i] + " = \'" + v[i] + "\')" + And
           checkWhere = true;

         }
       }
      }

      if(lr) {
        sql += " HAVING `distance` < "+ rd +" ORDER BY `distance`"
      }

     console.log(sql)
     handle_database(sql,res,sql)

 });

app.listen(3000, () => {
  console.log('Start server at port 3000.');
});
