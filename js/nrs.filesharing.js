/**
 * @depends {nrs.js}
 */
var NRS = (function(NRS, $, undefined) {

  var tagsPage = 1;
  var tagsPerPage = 40;
  var dataPage = 1;
  var itemsPerPage = 20;
  var currentSearch = {};
  var descriptionLength = 200;
  var Buffer, Parser;

  var updateDataList = function(query, all){
    currentSearch = query;
    var method = all ? 'getAllTaggedData' : 'searchTaggedData';
    if(query.account) method = 'getAccountTaggedData';
    if(query.channel) method = 'getChannelTaggedData';
    NRS.sendRequest(method, query, function(response) {

      // Clear table
      $("#p_filesharing_table tr").remove();

      var list = all ? response.taggedData : response.data;
      if(list) {
        $.each(list, function(i, data){
          insertRow(data);
        });

        if(list.length < itemsPerPage) $('#p_filesharing_pgn_tor_next').hide();
        else $('#p_filesharing_pgn_tor_next').show();
        if(query.firstIndex == 0) $('#p_filesharing_pgn_tor_prev').hide();
        else $('#p_filesharing_pgn_tor_prev').show();
      }
    });
  }

  var updateTagList = function(query) {

    NRS.sendRequest("getDataTags", query, function(response){

      // Clear list
      $("#p_filesharing_taglist li").remove();

      if(response.tags) {
        $.each(response.tags, function(i, data){

          var listelem = $('<li/>');
          var taglink = $('<a/>');
          var linktext = data.tag + ' (' + String(data.count) + ')';
          taglink.attr('href', '#');
          taglink.text(linktext);
          taglink.click(function(){
              dataPage = 1;
              var query = { tag : data.tag, firstIndex : 0, lastIndex : (itemsPerPage - 1) };
              updateDataList(query);
          });

          listelem.append(taglink);
          $('#p_filesharing_taglist').append(listelem);
        });

        if(response.tags.length < tagsPerPage) $('#p_filesharing_pgn_tag_next').hide();
        else $('#p_filesharing_pgn_tag_next').show();
      }
    });
  }

  /*
   * Get the info_hash value of a torrent
   */
  var getInfoHash = function(data) {

    var type = getTorrentType(data);
    
    if(type == 'magnet') {
      var regex = /\burn:btih:([A-F\d]{32,40})\b/i
      var match = regex.exec(data);
      if(match) return match[1];
    }

    else if(type == 'file') {
      var buf = Buffer(data, 'hex');
      try {
        var torrent = new Parser(buf);
        return torrent.infoHash;
      } catch (e) {
        console.log("Couldn't get info hash");
        console.log(e);
      }
    }

    return false;
  }

  /*
   * Base64 to Hex
   */
  var base64ToHex = function(str) {
    return new Buffer(str, 'base64').toString('hex');
  }

  /*
   * Hex to base64
   */
  var hexToBase64 = function(str) {
    return new Buffer(str, 'hex').toString('base64');
  }

  /*
   * Set up FileReader
   */
  $.getScript("plugins/filesharing/js/filereader.js", function(){

    var options = {
      readAsDefault: "DataURL",
      on: {
        load: function(e, file) {

          $('#p_filesharing_filename').val(file.name);
          $('#p_filesharing_type').val(file.type);
          $('#p_filesharing_add_istext').val('false');

          //TODO do this better
          var data = e.target.result.split(',', 2);
          var hex = base64ToHex(data[1]);

          $('#p_filesharing_data').val(hex);
        }
      }
    };

    // Wait a little bit until DOM is fully set up (for firefox)
    setTimeout(function(){
      FileReaderJS.setupInput(document.getElementById('p_filesharing_file'), options);
    }, 1000);
  });

  /*
   * Set up torrent file parser
   */
  $.getScript("plugins/filesharing/js/modules.js", function(){

    Buffer = p_filesharing_modules.Buffer;
    Parser = p_filesharing_modules.Parser;
  });

  /*
   * Determine the link type
   */
  var getTorrentType = function(data) {

    var parser = document.createElement('a');
    parser.href = data;

    if(parser.protocol == 'magnet:') return 'magnet';
    else {

      // is hex?
      if(data && data.match(/^[0-9a-f]+$/i))
        return 'file';
    }
    return false;
  }

  /*
   * Check if any of multiple values are present in tag array
   */
  var hasTag = function(arr, tags){
    for(var i in arr) {
      if(tags.indexOf(arr[i]) != -1) return true;
    }
    return false;
  }

  var insertRow = function(data) {

    var elem = $("#p_filesharing_list_tmpl").clone();

    elem.removeAttr('id'); // avoid duplicate ids

    // Glyphicon
    var title_icon = $('<span/>');
    var glyphicon = 'question-sign';

    // Set icon by mime type
    var filetype = data.type.split('/')[0];

    if(filetype == 'application' && data.type != 'application/x-bittorrent') glyphicon = 'cd';
    else if (filetype == 'audio') glyphicon = 'music';
    else if (filetype == 'image') glyphicon = 'picture';
    else if (filetype == 'text') glyphicon = 'book';
    else if (filetype == 'video') glyphicon = 'film';

    // If it's a torrent, let's choose the icon by tags
    else if(data.type == 'application/x-bittorrent') {
      if(hasTag(['video','film','movie'], data.parsedTags)) glyphicon = 'film';
      else if(hasTag(['audio','music','sound'], data.parsedTags)) glyphicon = 'music';
      else if(hasTag(['text','book','ebook', 'pdf'], data.parsedTags)) glyphicon = 'book';
      else if(hasTag(['image','picture','pictures','pics','gallery'], data.parsedTags)) glyphicon = 'picture';
      else if(hasTag(['application','software','game','games'], data.parsedTags)) glyphicon = 'cd';
    }

    title_icon.addClass('glyphicon glyphicon-' + glyphicon);
    $("p.p_filesharing_title", elem).append(title_icon);
    $("p.p_filesharing_title", elem).append(' <strong>' + String(data.name).escapeHTML() + '</strong>');

    // 'Open' Btn
    var type = getTorrentType(data.data);
    if(type) {

      var open_icon = $('<span/>');
      open_icon.addClass('glyphicon glyphicon-' + type);
      $("button.p_filesharing_openbtn", elem).prepend(open_icon);

      if(type == 'magnet') {
        $("button.p_filesharing_openbtn", elem).click(function() {
          window.open(encodeURI(data.data), '_blank');
        });
        $("button.p_filesharing_openbtn", elem).show();
      }
      else {
        var downloadlink = $('<a/>');

        try {
          var base64 = hexToBase64(data.data);

          // Default to application/octet-stream if no mime type specified
          if(!data.type) data.type = 'application/octet-stream';

          if(data.type.match(/^[-\w+]+\/[-\w+]+$/)) {        
            var uri = 'data:' + data.type + ';base64,' + encodeURIComponent(base64);
            downloadlink.attr('href', uri);
            downloadlink.attr('target', '_blank');
            if(data.filename) downloadlink.attr('download', encodeURIComponent(data.filename));
            $("button.p_filesharing_openbtn", elem).wrap(downloadlink);
            $("button.p_filesharing_openbtn", elem).show();
          }
        } catch(e) {
          // Invalid hex string
          // console.log(e);
        }
      }
    }

    // 'View' Btn
    var exptime = NRS.isTestNet ? 86400 : 1209600;
    var expdate = NRS.formatTimestamp(data.transactionTimestamp + exptime)
    $('button.p_filesharing_viewbtn', elem).click(function(){

      $('#p_filesharing_view_modal').find('h4').text(data.transaction);

      $('#p_filesharing_it_name').text(data.name);
      $('#p_filesharing_it_filename').text(data.filename);

      $('#p_filesharing_it_expdate').text(expdate);
      $('#p_filesharing_it_account').text(data.accountRS);
      $('#p_filesharing_it_description').html(String(data.description).autoLink());
      $('#p_filesharing_it_data').val(data.data);
    });

    // 'Extend' Btn
    $('button.p_filesharing_extendbtn', elem).click(function(){
      $('#p_filesharing_extend_modal').find('h4').text('Extend transaction ' + String(data.transaction));
      $('#p_filesharing_extend_error').hide();
      $('#p_filesharing_extend_transaction').val(data.transaction);
    });

    // Info
    var infos = $('<div/>');
    if(data.filename) {
      var filename = $('<p/>').text(data.filename);
      infos.append(filename);
    }

    if(data.channel) {
      var channel_link = $('<a/>');
      channel_link.attr('href', '#');
      channel_link.text(data.channel);
      channel_link.click(function(){

        // Get data by channel
        dataPage = 1;
        var query = { channel : data.channel, firstIndex : 0, lastIndex : (itemsPerPage - 1) };
        updateDataList(query);
      });
      infos.append($('<p/>').html(channel_link));
    }

    var acc_link = $('<a/>');
    acc_link.attr('href', '#');
    acc_link.text(data.accountRS);
    acc_link.click(function() {

      // Get data by account
      dataPage = 1;
      var query = { account : data.accountRS, firstIndex : 0, lastIndex : (itemsPerPage - 1) };
      updateDataList(query);

    });

    infos.append($('<p/>').html(acc_link));
    $("p.p_filesharing_info", elem).append(infos);

    // Description
    var description = data.description.substr(0,descriptionLength);
    if(description.length == descriptionLength) description += '...';
    $("p.p_filesharing_description", elem).append(String(description).autoLink());

    // Tags
    var tagstr = $('<small/>');
    var tags = data.tags.split(' ');

    $.each(tags, function(i, tag) {

      var tag_link = $('<a/>');
      tag_link.attr('href', '#');
      tag_link.text(tag);
      tag_link.click(function(){
        dataPage = 1;
        var query = { tag : tag, firstIndex : 0, lastIndex : (itemsPerPage - 1) };
        updateDataList(query);
      });

      tagstr.append(tag_link);
      if((i + 1) < tags.length) tagstr.append(', ');
    });

    $("p.p_filesharing_tags", elem).append(tagstr);

    // Expiration popover
    $("i.p_filesharing_extend_po", elem).attr('data-content', 'This record expires on ' + expdate);

    // External infos
    if(type == 'magnet' || (type == 'file' && data.type == 'application/x-bittorrent')) {

      $("button.p_filesharing_infobtn", elem).show();
      $("i.p_filesharing_warning_po", elem).show();

      $("button.p_filesharing_infobtn", elem).click(function(){

        var infohash = getInfoHash(data.data);
        if(!infohash) return; //TODO display error

        $("button.p_filesharing_infobtn", elem).hide();
        $("i.p_filesharing_warning_po", elem).hide();

        var fslink = 'http://bitsnoop.com/torrent/' + infohash;
        var fsimglink = 'http://bitsnoop.com/api/fakeskan.php?img=1&hash=' + infohash;
        var fsimg = $('<img border=0 width=148 height=18 />');
        fsimg.attr('src', fsimglink);

        $("a.p_filesharing_fakescan", elem).attr('href', fslink);
        $("a.p_filesharing_fakescan", elem).append(fsimg);

        // Get seeder and leecher numbers
        var url = 'https://getstrike.net/api/v2/torrents/info/?hashes=' + infohash;

        $.ajax({
          url : url,
          xhrFields: {
            withCredentials: false
          },
          dataType : 'json',
          success :  function( data ) {

            var seeders = '?', leechers = '?';
            if(data && data.torrents && data.torrents[0]) {
              seeders = data.torrents[0].seeds;
              leechers = data.torrents[0].leeches;
            }
            $("p.p_filesharing_extinfo", elem).append('<small>S: ' + seeders + ' / L: ' + leechers + '</small>');
          },
          error : function( data ) {
            $("p.p_filesharing_extinfo", elem).append('<small>S: ? / L: ?</small>');
          }
        });
      });
    }

    var row = $("<tr/>");
    var cell = $("<td/>");
    cell.append(elem);
    row.append(cell);
    $('#p_filesharing_table').append(row);

    elem.show();
  }

  NRS.pages.p_filesharing = function() {

    // Get latest data
    dataPage = 1;
    var query = { firstIndex : 0, lastIndex : (itemsPerPage - 1) };
    updateDataList(query, true);

    // Search form submit
    $('#p_filesharing_search_form').submit(function(e){

      e.preventDefault();
      var search = $('#p_filesharing_search_box').val();
      dataPage = 1;

      // Get data by search term
      var query = { query : search, firstIndex : 0, lastIndex : (itemsPerPage - 1) };
      var all = !search ? true : false;
      updateDataList(query, all);
    });

    // Add form submit
    $('#p_filesharing_add_form').submit(function(e){

      e.preventDefault();

      var query = {};
      query.name = $('#p_filesharing_name').val();
      query.description = $('#p_filesharing_description').val();
      query.channel = $('#p_filesharing_channel').val();
      query.data = $('#p_filesharing_data').val();
      query.type = $('#p_filesharing_type').val();
      query.filename = $('#p_filesharing_filename').val();
      query.tags = $('#p_filesharing_tags').val();
      query.isText = $('#p_filesharing_add_istext').val();
      query.feeNQT = (parseFloat($('#p_filesharing_add_fee').val()) * 100000000).toFixed(0);
      query.deadline = $('#p_filesharing_add_deadline').val();
      query.secretPhrase = $('#p_filesharing_add_password').val();

      if(!query.data.match(/^[0-9a-f]+$/i)) query.isText = 'true';


      NRS.sendRequest('uploadTaggedData', query, function(response) {

        if(response.errorDescription) {
          $('#p_filesharing_add_error').text(response.errorDescription);
          $('#p_filesharing_add_error').show();
        }
        else {
          $('#p_filesharing_add_modal').hide();
          $.growl("Data submitted successfully. (Transaction: " + response.transaction + ")", {
            "type": "success"
          });
        }
      });

    });

    // Extend form submit
    $('#p_filesharing_extend_form').submit(function(e){

      e.preventDefault();

      var query = {};
      query.transaction = $('#p_filesharing_extend_transaction').val();
      query.feeNQT = (parseFloat( $('#p_filesharing_extend_fee').val() ) * 100000000).toFixed(0);
      query.deadline = $('#p_filesharing_extend_deadline').val();
      query.secretPhrase = $('#p_filesharing_extend_password').val();
      
      NRS.sendRequest('extendTaggedData', query, function(response) {

        if(response.errorDescription) {
          $('#p_filesharing_extend_error').text(response.errorDescription);
          $('#p_filesharing_extend_error').show();
        }
        else {
          $('#p_filesharing_extend_modal').hide();
          $.growl("Transaction " + query.transaction + " has been extended.", {
            "type": "success"
          });
        }
      });
    });

    // Tag list
    updateTagList({ firstIndex : 0, lastIndex : (tagsPerPage - 1) });
    NRS.dataLoaded('');
  }

  NRS.setup.p_filesharing = function() {

    if(NRS.rememberPassword) $('.secret_phrase').hide();

    $('#p_filesharing_add_btn').click(function(){

      $('#p_filesharing_name').val('');
      $('#p_filesharing_description').val('');
      $('#p_filesharing_channel').val('');
      $('#p_filesharing_data').val('');
      $('#p_filesharing_type').val('');
      $('#p_filesharing_filename').val('');
      $('#p_filesharing_tags').val('');
      $('#p_filesharing_add_istext').val('true');
      $('#p_filesharing_add_password').val('');
      $('#p_filesharing_add_fee').val('1');
      $('#p_filesharing_add_deadline').val('24'); 
    });
  
    $('#p_filesharing_pgn_tor_next').click(function(){
      dataPage++;
      var query = currentSearch;
      var all = (!query.tag && !query.query && !query.account) ? true : false;
      query.firstIndex = (dataPage - 1) * itemsPerPage;
      query.lastIndex = (dataPage * itemsPerPage) - 1;
      $('#p_filesharing_pgn_tor_prev').show();
      updateDataList(query, all);
    });

    $('#p_filesharing_pgn_tor_prev').click(function(){
      dataPage--;
      var query = currentSearch;
      var all = (!query.tag && !query.query && !query.account) ? true : false;
      query.firstIndex = (dataPage - 1) * itemsPerPage;
      query.lastIndex = (dataPage * itemsPerPage) - 1;
      if(query.firstIndex == 0) $('#p_filesharing_pgn_tor_prev').hide();
      updateDataList(query, all);
    });

    $('#p_filesharing_pgn_tag_next').click(function(){
      tagsPage++;
      var query = { firstIndex: ((tagsPage - 1) * tagsPerPage), lastIndex : ((tagsPage * tagsPerPage) - 1) };
      $('#p_filesharing_pgn_tag_prev').show();
      updateTagList(query);
    });

    $('#p_filesharing_pgn_tag_prev').click(function(){
      tagsPage--;
      var query = { firstIndex: ((tagsPage - 1) * tagsPerPage), lastIndex : ((tagsPage * tagsPerPage) - 1) };
      if(query.firstIndex == 0) $('#p_filesharing_pgn_tag_prev').hide();
      updateTagList(query);
    });
  }

  return NRS;

}(NRS || {}, jQuery));

//File name for debugging (Chrome/Firefox)
//@ sourceURL=nrs.filesharing.js
