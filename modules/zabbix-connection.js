var request = require('request');

class ZabbixConnection {
  constructor(server_url) {
    if (!server_url) {
      throw new Error('Server url is required');
    }
    this.url = server_url;
    this.api_url = server_url + "/api_jsonrpc.php";
    this.req_pattern = {
      "jsonrpc": "2.0",
      "params": null,
      "id": null,
      "auth": null
    }
  }
  login(user, pass, callback = function (token) {
    return token;
  }, id = 1) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "user.login";
    var params = {
      "user": user,
      "password": pass
    };
    req.id = id;
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      zabbix.token = data.result;
      zabbix.id = data.id;
      zabbix.req_pattern.auth = data.result;
      zabbix.req_pattern.id = data.id;
      callback(data.result);
    });
  }
  logout(callback) {
    this.req_pattern.auth = null;
    callback();
  }
  get_api_version(callback = function (version) {
    return version;
  }, id = 1) {
    var zabbix = this;
    var req = {
      "jsonrpc": "2.0",
      "method": "apiinfo.version",
      "params": [],
      "id": id
    }
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  send(method, params, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = method;
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  /* get host */
  get_all_host(callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "host.get";
    var params = {
      "output": "extend",
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  get_host_by_hostids(hostids, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "host.get";
    var params = {
      "hostids": hostids,
      "output": "extend",
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  get_all_host_enable(callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "host.get";
    var params = {
      "output": "extend",
      "with_monitored_items": true,
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  get_all_host_enable_by_groupid(groupids, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "host.get";
    var params = {
      "output": "extend",
      "groupids": groupids,
      "with_monitored_items": true,
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  /* get hostgroup */
  get_all_host_group(callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "hostgroup.get";
    var params = {
      "output": ["groupid", "name"],
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  /* get_item */
  get_all_item_in_host_by_hostids(hostids, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "item.get";
    var params = {
      "hostids": hostids,
      "output": "extend",
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  get_item_in_host_by_itemsid(hostids, itemids, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "item.get";
    var params = {
      "hostids": hostids,
      "itemids": itemids,
      "output": "extend",
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }

  get_hosts_trigger_by_groupids(groupids, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "host.get";
    var params = {
      "output": ["hostid", "host"],
      "groupids": groupids,
      "with_monitored_items": true,
      "selectTriggers": ["description", "value", "priority", "lastchange"],
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }

  get_hosts_item_by_groupids(groupids, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "host.get";
    var params = {
      "output": ["hostid", "host", "snmp_available"],
      "groupids": groupids,
      "with_monitored_items": true,
      "selectItems": ["name", "key_", "lastvalue"],
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }

  get_all_map(callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "map.get";
    var params = {
      "output": ["sysmapid", "name"],
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }

  get_all_screen(callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "screen.get";
    var params = {
      "output": ["screenid", "name"],
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
  get_graph_by_hostid(hostid, callback) {
    var zabbix = this;
    var req = zabbix.req_pattern;
    req.method = "graph.get";
    var params = {
      "hostids": hostid,
      "output": ["graphid", "name"],
    }
    req.params = params;
    json_req(zabbix.api_url, "POST", req, function (err, res, data) {
      if (err) throw err;
      if (data.error) throw data.error.data;
      callback(data.result);
    });
  }
}

function json_req(url, method, json, callback) {
  var options = {
    headers: {
      name: 'content-type',
      value: 'application/json-rpc'
    },
  };
  options.url = url;
  options.method = method;
  options.json = json;
  request(options, callback);
}

module.exports = ZabbixConnection;