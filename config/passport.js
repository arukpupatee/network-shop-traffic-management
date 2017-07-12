var LocalStrategy = require('passport-local').Strategy;

module.exports = function(passport,users) {
  passport.serializeUser(function(user,done) {
    done(null, user.id);
  });
  passport.deserializeUser(function(id,done) {
    users.get_user_by_id(id, function(user){
      done(null,user);
    });
  });
  passport.use('local-signup', new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true
    }, function(req,username,password,done){
      var role = req.body.role;
      users.create_user(username,password,role,function(result){
        if(result == "Success"){
          users.authentication(username,password,function(user){
            //done(null,user);
            done(null,req.user); //if finish signup doesn't login as user that already signup
          });
        } else {
          done(null, false, req.flash('signupMessage', result));
        }
      });
    })
  );
  passport.use('local-login', new LocalStrategy({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true
    }, function(req,username,password,done){
      users.authentication(username,password,function(result){
        if((result=="Wrong password") || (result=="User not found")){
          return done(null, false, req.flash('loginMessage', result));
        } else {
          var user = result;
          return done(null, user);
        }
      });
    })
  );
}
