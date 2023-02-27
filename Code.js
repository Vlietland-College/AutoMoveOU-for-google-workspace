
let debug = true;
let mock_date = new Date(2023, 3,23);

var props = null;
const scriptProperties = PropertiesService.getScriptProperties();
function getProps(){
  if(props !== null){
    return props;
  }


  props = {
    "regex_matcher": new RegExp(scriptProperties.getProperty('regex_matcher')),
    "ou_id": scriptProperties.getProperty('ou_id'),
    "normal_id": scriptProperties.getProperty('normal_id'),
    "container_id": scriptProperties.getProperty('container_id'),
    "vacation_id": scriptProperties.getProperty('vacation_id'),
    "calendar_id": scriptProperties.getProperty('calendar_id')
  }

  return props

}

function dailyCheck(){
  let props = getProps()

  if(debug){console.log("ou: '%s' normal: '%s' vacation: '%s' calendar: %s", props.ou_id, props.normal_id, props.vacation_id, props.calendar_id)}

  if(props.ou_id === null || props.normal_id === null || props.vacation_id === null || props.calendar_id === null || props.regex_matcher.source === "null"){





    throw new Error("Not all required scriptproperties are set")
  }

  let calendar = CalendarApp.getCalendarById(props.calendar_id)
  let child_org_unit = AdminDirectory.Orgunits.get("my_customer", props.ou_id)

  var now = new Date();
  if(debug && mock_date){
    now = mock_date;
  }
  var twoHoursFromNow = new Date(now.getTime() + (2 * 60 * 60 * 1000));

  let events = calendar.getEvents(now, twoHoursFromNow);
  let is_vacation_day = false;

  if(events){
    for(let event of events){
      is_vacation_day = isEventVacation(event)

      if(is_vacation_day){
            if(debug){console.log("Vacation found %s", event.getTitle())}

        break;
        }
    }
  }
  else{
    if(debug){console.log("No events found today")}
  }

  let current_parent_id = child_org_unit.parentOrgUnitId

  if(is_vacation_day){
    if(current_parent_id !== props.vacation_id){
      //should switch to vacation
      console.info("Not in vacation and should be")
      res = setParentOU(child_org_unit.orgUnitPath, props.vacation_id)
      console.info("Moved ou to vacation")

    }
    else{
      if(debug){console.log("Vacation and in vacation")}
    }


  }
  else if(!is_vacation_day){

    if(current_parent_id !== props.normal_id){
      //in vacation and shouldnt be
      console.info("In vacation and shouldnt be")
      res = setParentOU(child_org_unit.orgUnitPath, props.normal_id)
       console.info("Moved ou to Normal")

    }
    else{
      if(debug){console.log("No vacation and in normal")}
    }
  }

}

function firstRun(){
  let ou_path =  scriptProperties.getProperty('ou_path').slice(1);
  try {
  // statements to try
    var container_org_unit = AdminDirectory.Orgunits.get("my_customer", ou_path)

  } catch (e) {
    console.error(e.name, "Orgunit not found: check the path");
    return;
  }

  scriptProperties.setProperty('container_id', container_org_unit.orgUnitId);


  // make the normal and vacation ou's
  let vacation_orgunit = AdminDirectory.Orgunits.insert({name: "Vacation", description: "Contains the OU that contains the chromeosdevices during holidays. Created by the script that moves the devices.", parentOrgUnitId: container_org_unit.orgUnitId}, "my_customer")
  scriptProperties.setProperty('vacation_id', vacation_orgunit.orgUnitId);
  console.log("Created vacation OU")

  let normal_orgunit = AdminDirectory.Orgunits.insert({name: "Normal", description: "Contains the OU that contains the chromeosdevices during regular weeks. Created by the script that moves the devices.",parentOrgUnitId: container_org_unit.orgUnitId}, "my_customer")
  scriptProperties.setProperty('normal_id', normal_orgunit.orgUnitId);
  console.log("Created normal OU")

  let target_orgunit = AdminDirectory.Orgunits.insert({name: container_org_unit.name, description: "Contains the actual chromedevices that should be moved by the script. This OU is moved by the script.",parentOrgUnitId: normal_orgunit.orgUnitId}, "my_customer")
  scriptProperties.setProperty('ou_id', target_orgunit.orgUnitId);
  console.log("Created sub OU")

  //rename ou
  let res = AdminDirectory.Orgunits.update({name:container_org_unit.name + " Container"}, "my_customer", container_org_unit.orgUnitId)
  console.log("Renamed container ou")

  moveDevicesFromContainer(container_org_unit.orgUnitId, target_orgunit.orgUnitId);

}

function moveDevicesFromContainer(from_unit, to_unit){
  console.log("Preparing to move devices..")

  var chromedevices = listChromeOsDevices(from_unit)
  if(!chromedevices){
    console.log("No chromeos devices found, we're done")
    return;
  }

  let chromeosdevices_ids = chromedevices.map(dev => dev.deviceId)
  console.log("Going to move %s devices..", chromeosdevices_ids.length)
  let res = AdminDirectory.Chromeosdevices.moveDevicesToOu({deviceIds:chromeosdevices_ids}, "my_customer", to_unit)
  //console.log(res)
  console.log("Moved devices!")

}

function listChromeOsDevices(orgunit_id) {
  let pageToken;
  let page;
  var devices = [];
  do {
    page = AdminDirectory.Chromeosdevices.list("my_customer",{
      orgUnitPath: orgunit_id,
      maxResults: 100,
      pageToken: pageToken
    });

    const new_devices = page.chromeosdevices;
    if (!new_devices) {
      console.log('No devices found.');
      return;
    }

    devices.push(...new_devices)
    pageToken = page.nextPageToken;
  } while (pageToken);
  return devices;
}

function isEventVacation(event){
  return props.regex_matcher.test(event.getTitle())

}

function setParentOU(child_ou_id, parent_ou_id){
  res = AdminDirectory.Orgunits.update({parentOrgUnitId:parent_ou_id}, "my_customer", child_ou_id.slice(1))
  return res
}

function  listAllOUs() {
  let pageToken;
  let page;
  do {
    page = AdminDirectory.Orgunits.list("my_customer", {type:"ALL"});
    const orgunits = page.organizationUnits;
    if (!orgunits) {
      console.log('No OUs found.');
      return;
    }
    // Print the user's full name and email.
    for (const orgunit of orgunits) {
      printOU(orgunit)
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
}

function undoChanges(){
  //undo changes done by firstrun
  let props = getProps()

  console.log("Resetting changes")
  moveDevicesFromContainer(props.ou_id, props.container_id)

  let container_name = AdminDirectory.Orgunits.get("my_customer", props.ou_id).name
  console.log("Preparing to remove lower ou..")
  AdminDirectory.Orgunits.remove("my_customer", props.ou_id)
  console.log("Preparing to remove vacation ou..")
  AdminDirectory.Orgunits.remove("my_customer", props.vacation_id)
  console.log("Preparing to remove normal ou..")
  AdminDirectory.Orgunits.remove("my_customer", props.normal_id)

  console.log("Resetting container name")
  AdminDirectory.Orgunits.update({name: container_name}, "my_customer", props.container_id)


}

function printOU(orgunit){
    console.log(orgunit)
    console.log('%s [%s] (%s)', orgunit.name, orgunit.orgUnitPath, orgunit.orgUnitId);
}
