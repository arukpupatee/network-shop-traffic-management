var sqlite3 = require('sqlite3').verbose();
var bcrypt = require('bcrypt-nodejs');
const uuidv4 = require('uuid/v4');

class Users {
  constructor(db_path) {
    this.db = new sqlite3.Database(db_path);
  }
  get_user_by_id(id, callback) {
    this.db.all("SELECT id,role FROM users WHERE id='" + id + "'", function (err, rows) {
      if (err) throw err;
      if (rows.length == 0) {
        callback(null);
      } else {
        callback(rows[0]);
      }
    });
  }
  create_user(username, password, role, callback) {
    var Users = this;
    Users.db.all("SELECT id FROM users WHERE username='" + username + "'", function (err, rows) {
      if (rows.length == 0) {
        var new_id = uuidv4();
        var pass = bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
        Users.db.run("INSERT INTO users VALUES('" + new_id + "','" + username + "','" + pass + "','" + role + "')");
        callback("Success");
      } else {
        callback("User is in use");
      }
    });
  }
  authentication(username, password, callback) {
    var Users = this;
    Users.db.all("SELECT id FROM users WHERE username='" + username + "'", function (err, rows) {
      if (rows.length > 0) {
        Users.db.all("SELECT * FROM users WHERE id='" + rows[0].id + "'", function (err, rows) {
          if (bcrypt.compareSync(password, rows[0].password)) {
            Users.get_user_by_id(rows[0].id, function (user) {
              callback(user);
            });
          } else {
            callback("Wrong password");
          }
        });
      } else {
        callback("User not found");
      }
    });
  }
  change_password(id, old_password, new_password, callback) {
    var Users = this;
    Users.db.all("SELECT * FROM users WHERE id='" + id + "'", function (err, rows) {
      if (rows.length > 0) {
        if (bcrypt.compareSync(old_password, rows[0].password)) {
          var pass = bcrypt.hashSync(new_password, bcrypt.genSaltSync(8), null);
          Users.db.run("UPDATE users SET password='" + pass + "' WHERE id='" + id + "'");
          callback("Success");
        } else {
          callback("Wrong old password");
        }
      } else {
        callback("User not found");
      }
    });
  }
  get_all_users(callback) {
    var Users = this;
    Users.db.all("SELECT id,username,role FROM users", function (err, rows) {
      callback(rows);
    })
  }
  delete_user_by_id(id, callback) {
    var Users = this;
    Users.db.run("DELETE FROM users WHERE id='" + id + "'");
    callback("Success");
  }
}

module.exports = Users;