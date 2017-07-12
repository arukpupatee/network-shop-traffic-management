/* Network Shop Traffic Management */

var express = require('express'); //package for make node as web server
var app = express(); //instance for express package
var router = express.Router();
var ejs = require('ejs'); //package for view engine
var bodyParser = require('body-parser');
var passport = require('passport');
var flash = require('connect-flash');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var request = require('request'); //package for send request
var async = require('async');
var fs = require('fs');
var app_config = JSON.parse(fs.readFileSync('./config/app_config.json', 'utf8')); //load config about running app
var config = JSON.parse(fs.readFileSync('./config/customize_config.json', 'utf8')); //load config about customize web app

var ZabbixConnection = require('./modules/zabbix-connection.js');
var zabbix = new ZabbixConnection(config.zabbix.url);
zabbix.login(config.zabbix.username,config.zabbix.password, function(res){ if(res.error) throw res.error.data;});

var Users = require('./app/models/users.js');
var users = new Users('./app/models/users.db');

app.set('view engine', 'ejs'); // set the view engine to ejs
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use(session({
  secret:'TRUE-ITO-Retail',
  saveUninitialized: true,
  resave: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
require('./config/passport')(passport,users);

var baseUrl = app_config.baseUrl;
app.use(baseUrl,router);

router.get('/', function(req, res) {
  res.redirect(baseUrl+'/dashboard?show=Summary');
});
router.get('/dashboard', function(req, res) {
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    var obj = {};
    obj.baseUrl = baseUrl;
    obj.zabbix_url = config.zabbix.url;
    if(req.isAuthenticated()){ obj.user = req.user;} else { obj.user = null; }
    obj.btn_group_label = "Dashboard:";
    obj.part_title = "True Shop "+req.query.show;
    obj.btn_group_list = [];
    obj.alerts_danger_priority = config.alerts.danger_when_priority_more_than;
    obj.alerts_warning_priority = config.alerts.warning_when_priority_more_than;
    obj.traffics_danger_percent = config.traffics.danger_when_traffic_percent_more_than;
    obj.traffics_warning_percent = config.traffics.warning_when_traffic_percent_more_than;
    obj.alerts_refresh_rate = config.alerts.refresh_rate*1000;
    obj.traffics_refresh_rate = config.traffics.refresh_rate*1000;
    get_router_groups(function(router_groups){
    async.each(router_groups, function(group,callback_group){
      obj.btn_group_list.push({'title':group.area,'src':'/dashboard?show='+group.area,'active':false});
      callback_group(null);
    },function(err){
      for(i=0;i<obj.btn_group_list.length;i++){
        if(obj.btn_group_list[i].title == req.query.show){
          obj.btn_group_list[i].active = true;
        }
      };
      get_router_maps(function(maps){
        json_in_array_to_json(router_groups,"area",function(router_groups_id_data){
          json_in_array_to_json(maps,"area",function(maps_id_data){
            obj.map_id = (maps_id_data[req.query.show]===undefined) ? "" : maps_id_data[req.query.show].mapid;
            if(router_groups_id_data[req.query.show] === undefined){
              res.redirect(baseUrl+'/dashboard?show=Summary');
            } else if(req.query.show == "Summary"){
              obj.area = [];
              async.each(router_groups,function(group,callback_group){
                var area = {};
                area.title = group.area;
                area.group_id = group.groupid;
                get_alert_hosts_and_hosts_traffic(area.group_id,function(results){
                  area.alert_hosts = results.alert_hosts;
                  area.hosts_with_traffic = results.hosts_with_traffic;
                  if(area.alert_hosts.length != 0){
                    area.total_alerts_show = (config.alerts.total_shows=="all")?area.alert_hosts.length:(Number(config.alerts.total_shows)>area.alert_hosts.length)?area.alerts_hosts.length:Number(config.alerts.total_shows);
                  } else {
                    area.total_alerts_show = 0;
                  }
                  if(area.hosts_with_traffic.length != 0){
                    area.max_traffic = area.hosts_with_traffic[0].traffic;
                    area.max_traffic_percent = area.hosts_with_traffic[0].traffic_percent;
                    area.min_traffic = area.hosts_with_traffic[area.hosts_with_traffic.length - 1].traffic;
                    area.min_traffic_percent = area.hosts_with_traffic[area.hosts_with_traffic.length - 1].traffic_percent;
                    area.total_traffics_show = (config.traffics.total_shows=="all")?area.hosts_with_traffic.length:(Number(config.traffics.total_shows)>area.hosts_with_traffic.length)?area.hosts_with_traffic.length:Number(config.traffics.total_shows);
                  } else {
                    area.max_traffic = "-";
                    area.max_traffic_percent = "-";
                    area.min_traffic = "-";
                    area.min_traffic_percent = "-";
                    area.total_traffics_show = 0;
                  };
                  let total_traffic = 0;
                  let total_traffic_percent = 0;
                  async.each(area.hosts_with_traffic,function(host,callback_avg){ //find avg
                    if(area.hosts_with_traffic.length != 0){
                      total_traffic += host.incoming_traffic;
                      total_traffic_percent += Number(host.traffic_percent);
                    }
                    callback_avg(null);
                  },function(err){
                    if(area.hosts_with_traffic.length != 0){
                      let avg = total_traffic/area.hosts_with_traffic.length;
                      area.avg_traffic = (avg>=1000000)? (avg/1000000).toFixed(2)+" Mbps" : (avg>=1000)? (avg/1000).toFixed(2)+" Kbps" : avg+" bps";
                      area.avg_traffic_percent = (total_traffic_percent/area.hosts_with_traffic.length).toFixed(2);
                    } else {
                      area.avg_traffic = "-";
                      area.avg_traffic_percent = "-";
                    }
                    obj.area.push(area);
                    callback_group(null);
                  });
                });
              },function(err){
                async.sortBy(obj.area,function(area,callback_sort){
                  callback_sort(null,Number(area.group_id));
                },function(err,sorted_area){
                  obj.area = sorted_area;
                  res.render('pages/dashboard-summary',obj);
                });
              });
            } else {
              obj.group_id = router_groups_id_data[req.query.show].groupid;
              get_alert_hosts_and_hosts_traffic(obj.group_id,function(results){
                obj.alert_hosts = results.alert_hosts;
                obj.hosts_with_traffic = results.hosts_with_traffic;
                if(obj.alert_hosts.length != 0){
                  obj.total_alerts_show = (config.alerts.total_shows=="all")?obj.alert_hosts.length:(Number(config.alerts.total_shows)>obj.alert_hosts.length)?obj.alerts_hosts.length:Number(config.alerts.total_shows);
                } else {
                  obj.total_alerts_show = 0;
                }
                if(obj.hosts_with_traffic.length != 0){
                  obj.max_traffic = obj.hosts_with_traffic[0].traffic;
                  obj.max_traffic_percent = obj.hosts_with_traffic[0].traffic_percent;
                  obj.min_traffic = obj.hosts_with_traffic[obj.hosts_with_traffic.length - 1].traffic;
                  obj.min_traffic_percent = obj.hosts_with_traffic[obj.hosts_with_traffic.length - 1].traffic_percent;
                  obj.total_traffics_show = (config.traffics.total_shows=="all")?obj.hosts_with_traffic.length:(Number(config.traffics.total_shows)>obj.hosts_with_traffic.length)?obj.hosts_with_traffic.length:Number(config.traffics.total_shows);
                  let total_traffic = 0;
                  let total_traffic_percent = 0;
                  async.each(obj.hosts_with_traffic,function(host,callback_avg){ //find avg
                    total_traffic += host.incoming_traffic;
                    total_traffic_percent += Number(host.traffic_percent);
                    callback_avg(null);
                  },function(err){
                    let avg = total_traffic/obj.hosts_with_traffic.length;
                    obj.avg_traffic = (avg>=1000000)? (avg/1000000).toFixed(2)+" Mbps" : (avg>=1000)? (avg/1000).toFixed(2)+" Kbps" : avg+" bps";
                    obj.avg_traffic_percent = (total_traffic_percent/obj.hosts_with_traffic.length).toFixed(2);
                    res.render('pages/dashboard-part',obj);
                  });
                } else {
                  obj.max_traffic = "-";
                  obj.max_traffic_percent = "-";
                  obj.avg_traffic = "-";
                  obj.avg_traffic_percent = "-";
                  obj.min_traffic = "-";
                  obj.min_traffic_percent = "-";
                  obj.total_traffics_show = 0;
                  res.render('pages/dashboard-part',obj);
                }
              });
            }
          });
        });
      });
    });
  });
  }
});
router.get('/alerts/:groupid',function(req,res){
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    let group_id = req.params.groupid;
    get_alert_hosts(group_id, function(alert_hosts){
      var res_obj = {};
      res_obj.alert_hosts = alert_hosts;
      res.json(res_obj);
    });
  }
});
router.get('/traffics/:groupid',function(req,res){
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    let group_id = req.params.groupid;
    get_hosts_traffic(group_id, function(hosts_with_traffic){
    var res_obj = {};
    if(hosts_with_traffic.length != 0){
      res_obj.hosts_with_traffic = hosts_with_traffic;
      res_obj.max_traffic = hosts_with_traffic[0].traffic;
      res_obj.max_traffic_percent = hosts_with_traffic[0].traffic_percent;
      res_obj.min_traffic = hosts_with_traffic[hosts_with_traffic.length - 1].traffic;
      res_obj.min_traffic_percent = hosts_with_traffic[hosts_with_traffic.length -1].traffic_percent;
      let total_traffic = 0;
      let total_traffic_percent = 0;
      async.each(hosts_with_traffic,function(host,callback_each){
        total_traffic += host.incoming_traffic;
        total_traffic_percent += Number(host.traffic_percent);
        callback_each(null);
      },function(err,hosts_sorted){
        let avg = total_traffic/hosts_with_traffic.length;
        res_obj.avg_traffic = (avg>1000000)? (avg/1000000).toFixed(2)+" Mbps" : (avg>1000)? (avg/1000).toFixed(2)+" Kbps": avg+" bps";
        res_obj.avg_traffic_percent = (total_traffic_percent/res_obj.hosts_with_traffic.length).toFixed(2);
        res.json(res_obj);
      });
    } else {
      res_obj.host_with_traffic = hosts_with_traffic;
      res_obj.max_traffic = "-";
      res_obj.max_traffic_percent = "-";
      res_obj.avg_traffic = "-";
      res_obj.avg_traffic_percent = "-";
      res_obj.min_traffic = "-";
      res_obj.min_traffic_percent = "-";
      res.json(res_obj);
    }
  });
  }
});
router.get('/map', function(req, res) {
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    var obj = {};
    obj.baseUrl = baseUrl;
    obj.zabbix_url = config.zabbix.url;
    if(req.isAuthenticated()){ obj.user = req.user;} else { obj.user = null; }
    obj.map_tree_source = [];
    obj.btn_group_label_router_map = "Map Router:";
    obj.btn_group_label_detail_map = "Map Detail:";
    obj.map_title = "True Shop "+req.query.show;
    obj.map_tree_source = [];
    var router_maps = [];
    var detail_maps = [];
    var total_maps = []
    get_router_maps(function(r_maps){
    async.each(r_maps, function(map,callback_router_maps){
      router_maps.push({'title':map.area,'key':map.area,'href':'/map?show='+map.area,'active':false});
      total_maps.push(map);
      callback_router_maps(null);
    },function(err){
      for(i=0;i<router_maps.length;i++){
        if(router_maps[i].title == req.query.show){
          router_maps[i].active = true;
        }
      };
      get_detail_maps(function(d_maps){
        async.each(d_maps, function(map,callback_detail_maps){
          detail_maps.push({'title':map.area.replace(config.maps.detail_map_name_ends_with,""),'key':map.area,'href':'/map?show='+map.area,'active':false});
          total_maps.push(map);
          callback_detail_maps(null);
        },function(err){
          for(i=0;i<detail_maps.length;i++){
            if(detail_maps[i].title+config.maps.detail_map_name_ends_with == req.query.show){
              detail_maps[i].active = true;
            }
          };
          obj.map_tree_source.push({
            title: "Router Maps",
            key: "router_maps",
            active: false,
            folder: true,
            children: router_maps
          });
          obj.map_tree_source.push({
            title: "Detail Maps",
            key: "detail_maps",
            active: false,
            folder: true,
            children: detail_maps
          });
          json_in_array_to_json(total_maps,"area",function(maps_id_data){
            obj.map_id = (req.query.show === undefined)? undefined : maps_id_data[(req.query.show)].mapid;
            if(obj.map_id === undefined){ // if query text doesn't match
              res.redirect(baseUrl+'/map?show=Summary');
            } else {
              res.render('pages/map',obj);
            }
          });
        });
      });
    });
  });
  }
});
router.get('/graph', function(req, res) {
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    var obj = {}
    obj.baseUrl = baseUrl;
    obj.zabbix_url = config.zabbix.url;
    if(req.isAuthenticated()){ obj.user = req.user;} else { obj.user = null; }
    res.render('pages/graph',obj);
  }
});
router.get('/screen', function(req, res) {
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    var obj = {};
    obj.baseUrl = baseUrl;
    obj.zabbix_url = config.zabbix.url;
    if(req.isAuthenticated()){ obj.user = req.user;} else { obj.user = null; }
    obj.btn_group_label = "Screen:";
    obj.screen_title = req.query.show;
    obj.btn_group_list = [];
    var all_screens = [];
    get_screens(function(screens){
    async.each(screens,function(scr,callback_each){
      obj.btn_group_list.push({'title':scr.name,'src':'/screen?show='+scr.name,'active':false});
      all_screens.push(scr);
      callback_each(null);
    },function(err){
      for(i=0;i<obj.btn_group_list.length;i++){
        if(obj.btn_group_list[i].title == req.query.show){
          obj.btn_group_list[i].active = true;
        }
      };
      json_in_array_to_json(all_screens,"name",function(screen_id_data){
        obj.screen_id = (screen_id_data[req.query.show]===undefined)? undefined : screen_id_data[req.query.show].screenid;
        if(obj.screen_id === undefined){ // if query text doesn't match
          res.redirect(baseUrl+'/screen?show=Zabbix server');
        }
        else{
          res.render('pages/screen',obj);
        }
      });
    });
  });
  }
});
router.get('/user/login', function(req, res){
  if(req.isAuthenticated()){
    res.redirect(baseUrl+'/');
  } else {
    var obj = {};
    obj.message = req.flash('loginMessage');
    obj.baseUrl = baseUrl;
    obj.zabbix_url = config.zabbix.url;
    res.render('pages/user/login.ejs',obj);
  }
});
router.post('/user/login',passport.authenticate('local-login',{
  successRedirect: baseUrl+'/',
  failureRedirect: baseUrl+'/user/login',
  failureFlash: true
}));
router.get('/user/logout', function(req, res) {
  req.logout();
  res.redirect(baseUrl+'/');
});
router.get('/user/change_password',function(req, res){
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    var obj = {};
    obj.baseUrl = baseUrl;
    obj.zabbix_url = config.zabbix.url;
    obj.user = req.user;
    obj.message = "";
    res.render('pages/user/change_password',obj);
  }
});
router.post('/user/change_password',function(req, res){
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    var old_pass = req.body.old_password;
    var new_pass = req.body.new_password;
    var confirm_new_pass = req.body.confirm_new_password;
    var obj = {}
    obj.baseUrl = baseUrl;
    if(new_pass != confirm_new_pass){
      obj.message = "Invalid confirm password";
      res.render('pages/user/change_password',obj);
    } else {
      users.change_password(req.user.id,old_pass,new_pass,function(result){
        if(result=="Wrong old password"){
          obj.message = result;
          res.render('pages/user/change_password',obj);
        } else {
          res.redirect(baseUrl+'/');
        }
      });
    }
  }
});
router.get('/user/signup', function(req, res){
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    if(req.user.role != "admin"){
      res.redirect(baseUrl+'/');
    } else {
      var obj = {};
      obj.message = req.flash('signupMessage');
      obj.baseUrl = baseUrl;
      obj.zabbix_url = config.zabbix.url;
      obj.user = req.user;
      res.render('pages/user/signup.ejs',obj);
    }
  }
});
router.post('/user/signup',passport.authenticate('local-signup',{
  successRedirect: baseUrl+'/admin/users_management',
  failureRedirect: baseUrl+'/user/signup',
  failureFlash: true
}));
router.get('/admin/config', function(req, res){
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    if(req.user.role == "admin"){
      var obj = {}
      obj.baseUrl = baseUrl;
      obj.user = req.user;
      obj.zabbix_url = config.zabbix.url;
      obj.config = config;
      res.render('pages/admin/config',obj);
    } else {
      res.redirect(baseUrl+'/');
    }
  }
});
router.post('/admin/config', function(req, res){
  if( ! req.isAuthenticated()){
    res.redirect(baseUrl+'/user/login');
  } else if(req.user.role != "admin"){
    res.redirect(baseUrl+'/');
  } else {
    var new_config = req.body;
    config.zabbix.url = new_config.zabbix_url;
    config.zabbix.username = new_config.zabbix_username;
    config.zabbix.password = new_config.zabbix_password;
    config.router_groups.summary_name = new_config.router_groups_summary_name;
    config.router_groups.name_starts_with = new_config.router_groups_name_starts_with;
    config.router_groups.subgroup_name_starts_with = new_config.router_groups_subgroup_name_starts_with;
    config.router_groups.subgroup_name_ends_with = new_config.router_groups_subgroup_name_ends_with;
    config.maps.summary_name = new_config.maps_summary_name;
    config.maps.name_starts_with = new_config.maps_name_starts_with;
    config.maps.submap_name_starts_with = new_config.maps_submap_name_starts_with;
    config.maps.submap_name_ends_with = new_config.maps_submap_name_ends_with;
    config.maps.detail_map_name_starts_with = new_config.maps_detail_map_name_starts_with;
    config.maps.detail_map_name_ends_with = new_config.maps_detail_map_name_ends_with;
    var triggers = []
    for(i=0;i<new_config.alerts_trigger_name.length;i++){
      var new_trigger = {}
      new_trigger.name = new_config.alerts_trigger_name[i];
      new_trigger.display = new_config.alerts_trigger_display[i];
      triggers.push(new_trigger);
    }
    config.alerts.triggers = triggers;
    config.alerts.danger_when_priority_more_than = Number(new_config.alerts_danger_priority);
    config.alerts.warning_when_priority_more_than = Number(new_config.alerts_warning_priority);
    config.alerts.total_shows = (new_config.alerts_total_shows=="all")? new_config.alerts_total_shows: Number(new_config.alerts_total_shows);
    config.alerts.refresh_rate = Number(new_config.alerts_refresh_rate);
    config.traffics.max_link_traffic = Number(new_config.traffics_max_link_traffic);
    config.traffics.interfaces = new_config.traffics_interfaces;
    config.traffics.icmp_ping_key_ = new_config.traffics_icmp_ping_key_;
    config.traffics.danger_when_traffic_percent_more_than = Number(new_config.traffics_danger_percent);
    config.traffics.warning_when_traffic_percent_more_than = Number(new_config.traffics_warning_percent);
    config.traffics.total_shows = (new_config.traffics_total_shows=="all")? new_config.traffics_total_shows: Number(new_config.traffics_total_shows);
    config.traffics.refresh_rate = Number(new_config.traffics_refresh_rate);
    fs.writeFileSync('./config/customize_config.json',JSON.stringify(config));
    zabbix.logout(function(){
      zabbix.login(config.zabbix.username,config.zabbix.password, function(r){
        if(r.error) throw r.error.data;
        res.redirect(baseUrl+'/dashboard?show=Summary');
      });
    });
  }
});
router.get('/admin/users_management', function(req, res){
  if( ! req.isAuthenticated() ){
    res.redirect(baseUrl+'/user/login');
  } else {
    if(req.user.role == "admin"){
      var obj = {}
      obj.baseUrl = baseUrl;
      obj.user = req.user;
      obj.zabbix_url = config.zabbix.url;
      obj.config = config;
      users.get_all_users(function(all_users){
        obj.all_users = all_users;
        res.render('pages/admin/users_management',obj);
      });
    } else {
      res.redirect(baseUrl+'/');
    }
  }
});
router.post('/admin/users_management/delete_user',function(req,res){
  if( ! req.isAuthenticated()){
    res.redirect(baseUrl+'/user/login');
  } else if(req.user.role != "admin"){
    res.redirect(baseUrl+'/');
  } else {
    var user_id = req.body.user_id;
    users.delete_user_by_id(user_id,function(status){
      if(status=="Success"){
        var res_obj = {}
        res_obj.delete_status = status;
        res_obj.user_id = user_id;
        res.json(res_obj);
      }
    });
  }
});

function get_router_maps(callback){
  zabbix.get_all_map(function(maps){
    router_maps = [];
    async.each(maps, function(map,callback_map){
      if((map.name==config.maps.summary_name)||( map.name.startsWith(config.maps.name_starts_with)&&((!map.name.startsWith(config.maps.submap_name_starts_with))||(!map.name.endsWith(config.maps.submap_name_ends_with))))){
        let map_area = (map.name == config.maps.summary_name) ? "Summary" : map.name.replace(config.maps.name_starts_with,"");
        let m = {
          mapid: map.sysmapid,
          name: map.name,
          area: map_area,
        }
        router_maps.push(m);
      }
      callback_map(null);
    },function(err){
      if(err) throw err;
      async.sortBy(router_maps, function(map, callback_sort) {
        callback_sort(null, Number(map.mapid));
      }, function(err,results) {
        callback(results);
      });
    });
  });
}
function get_detail_maps(callback){
  zabbix.get_all_map(function(maps){
    router_maps = [];
    async.each(maps, function(map,callback_map){
      if((map.name.startsWith(config.maps.detail_map_name_starts_with)&&(map.name.endsWith(config.maps.detail_map_name_ends_with)))){
        let map_area = map.name.replace(config.maps.detail_map_name_starts_with,"");
        let m = {
          mapid: map.sysmapid,
          name: map.name,
          area: map_area,
        }
        router_maps.push(m);
      }
      callback_map(null);
    },function(err){
      if(err) throw err;
      async.sortBy(router_maps, function(map, callback_sort) {
        callback_sort(null, Number(map.mapid));
      }, function(err,results) {
        callback(results);
      });
    });
  });
}
function get_router_groups(callback){
  zabbix.get_all_host_group(function(groups){
    router_groups = [];
    async.each(groups, function(group,callback_group){
      if((group.name==config.router_groups.summary_name) || ( group.name.startsWith(config.router_groups.name_starts_with) && !group.name.endsWith("bps") )){
        let group_area = (group.name == config.router_groups.summary_name) ? "Summary" : group.name.replace(config.router_groups.name_starts_with,"");
        let r = {
          groupid: group.groupid,
          name: group.name,
          area: group_area,
        }
        router_groups.push(r);
      }
      callback_group(null);
    },function(err){
      if(err) throw err;
      async.sortBy(router_groups, function(group, callback_sort) {
        callback_sort(null, Number(group.groupid));
      }, function(err,results) {
        callback(results);
      });
    });
  });
}
function get_alert_hosts_and_hosts_traffic(groupids,callback){
  async.parallel({
    alert_hosts: function(callback) {
      get_alert_hosts(groupids, function(hosts){
        callback(null,hosts);
      });
    },
    hosts_with_traffic: function(callback) {
      get_hosts_traffic(groupids, function(hosts){
        callback(null,hosts);
      });
    }
  }, function(err, results) {
    callback(results);
  });
}
function get_alert_hosts(groupids,callback){
  zabbix.get_hosts_trigger_by_groupids(groupids,function(hosts){
    var alert_hosts = [];
    async.each(hosts, function(host,callback_host) {
      async.each(host.triggers, function(trigger,callback_trigger) {
        if(trigger.value == "1"){
          if(is_json_in_array_match(trigger.description,config.alerts.triggers,"name")){
            json_in_array_to_json(config.alerts.triggers,"name",function(t){ triggers=t; });
            let problem = triggers[trigger.description].display;
            let t = new Date(trigger.lastchange*1000);
            let year = t.getFullYear();
            let month = (t.getMonth()+1 < 10) ? "0"+(t.getMonth()+1) : ""+t.getMonth()+1;
            let date = (t.getDate() < 10) ? "0"+t.getDate() : ""+t.getDate();
            let hour = (t.getHours() < 10) ? "0"+t.getHours() : ""+t.getHours();
            let minutes = (t.getMinutes() < 10) ? "0"+t.getMinutes() : ""+t.getMinutes();
            let second = (t.getSeconds() < 10) ? "0"+t.getSeconds() : ""+t.getSeconds();
            let timestamp = year+"-"+month+"-"+date+" "+hour+":"+minutes+":"+second;
            alert_hosts.push({
              "unix_timestamp": Number(trigger.lastchange),
              "timestamp": timestamp,
              "hostid": host.hostid,
              "name": host.host,
              "issue": problem,
              "priority": trigger.priority,
            });
          }
        }
        callback_trigger(null);
      } , function(err) {
        if(err) throw err;
        callback_host(null);
      });
    } , function(err) {
      if(err) throw err;
      async.sortBy(alert_hosts, function(alert_host, callback) {
        callback(null, alert_host.unix_timestamp *-1); // *-1 for descending
      }, function(err,result) {
        callback(result);
      });
    });
  });
}
function get_hosts_traffic(groupids,callback){
  zabbix.get_hosts_item_by_groupids(groupids,function(hosts){
    var hosts_with_traffic = [];
    async.each(hosts, function(host,callback_host) {
      var host_with_traffic = {"hostid":host.hostid,"name":host.host};
      async.each(host.items, function(item,callback_item) {
        if( item.key_.startsWith("ifInOctets[") && is_string_include_substring_in_array(item.key_,config.traffics.interfaces) ){
          host_with_traffic.incoming_traffic = Number(item.lastvalue);
        }
        else if( item.key_.startsWith("ifIOutOctets[") && is_string_include_substring_in_array(item.key_,config.traffics.interfaces) ){
          host_with_traffic.outgoing_traffic = Number(item.lastvalue);
        }
        else if( item.key_==config.traffics.icmp_ping_key_ ){
          host_with_traffic.icmpping = Number(item.lastvalue);
        }
        else if( item.key_.startsWith("ifInOctetsPercent[") && is_string_include_substring_in_array(item.key_,config.traffics.interfaces) ){
          host_with_traffic.traffic_percent = Number(item.lastvalue).toFixed(2);
        }
        callback_item(null);
      } , function(err) {
        if(err) throw err;
        if( (host_with_traffic.icmpping==1) && (typeof host_with_traffic.incoming_traffic!="undefined") && (host_with_traffic.incoming_traffic != 0) ){
          host_with_traffic.traffic = (host_with_traffic.incoming_traffic >= 1000000000)?(host_with_traffic.incoming_traffic/1000000000).toFixed(2)+" Gbps":(host_with_traffic.incoming_traffic >= 1000000)?(host_with_traffic.incoming_traffic/1000000).toFixed(2)+" Mbps":(host_with_traffic.incoming_traffic >= 1000)?(host_with_traffic.incoming_traffic/1000).toFixed(2)+" Kbps":host_with_traffic.incoming_traffic+" bps";
          hosts_with_traffic.push(host_with_traffic);
        }
        callback_host(null);
      });
    } , function(err) {
      if(err) throw err;
      async.sortBy(hosts_with_traffic, function(host, callback) {
        callback(null, Number(host.traffic_percent) *-1); // *-1 for descending
      }, function(err,result) {
        callback(result);
      });
    });
  });
}
function get_screens(callback){
  zabbix.get_all_screen(function(results){
    callback(results);
  });
}

/* Utility Function */
function json_in_array_to_json(arr,keyname,callback){
  /* example
  array is var a = [{id:"1","Aruk"},{id:"2","Pupatee"},{id:"3","eiei"}]
  call function like this json_in_array_to_json(a,"id",callback)
  response is {"1":{id:"1","Aruk"},"2":{id:"2","Pupatee"},"3":{id:"3","eiei"}}
  */
  var json_obj = {};
  async.each(arr,function(obj_in_arr,callback_each){
    json_obj[ obj_in_arr[keyname] ] = obj_in_arr;
    callback_each(null);
  },function(err){
    callback(json_obj);
  });
}
function is_in_array(item,arr){
  var is_in_arr = false;
  for(let i=0;i<arr.length;i++){
    is_in_arr = is_in_arr || (arr[i]==item);
  }
  return is_in_arr;
}
function is_string_include_substring_in_array(string,arr){
  var is_include = false;
  for(let i=0;i<arr.length;i++){
    is_include = is_include || string.includes(arr[i]);
  }
  return is_include;
}
function is_json_in_array_match(item,arr,json_key_){
  var is_in_arr = false;
  for(let i=0;i<arr.length;i++){
    is_in_arr = is_in_arr || (arr[i][json_key_]==item);
  }
  return is_in_arr;
}

app.listen(app_config.port);
console.log("Network Shop Traffic Management at Port "+app_config.port);
