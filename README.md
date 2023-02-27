# AutoMoveOU for Google Workspace

## In short..
This script automatically moves a organisational unit based on a Google Calendar to automatically switch between policies during holidays.


## The situation
We have a BYOD technology program at our school: student either rent or buy a chromeOS device. In order to enforce policies and enable our teachers to monitor the devices they are enrolled as a managed device within our Workspace environment. During regular schooldays students are [forced to login using their school-issued account](https://chromeenterprise.google/policies/#DeviceUserAllowlist). We use the [DeviceOffHours policy](https://chromeenterprise.google/policies/#DeviceOffHours) to allow non-managed users to log in outside of the school hours and during weekends. This is important because the devices are property of the students so they should be able to use device as they'd like when they're not in school.

## The problem
While DeviceOffHours works fine during regular weeks, it does not provide a solution for the holidays. Someone had to manually turn off the restrictions at the beginning and end of a holiday. A simple task but, if forgotten, there is a chance the students either can't fully use their devices or teachers aren't able to monitor the students. 

## The solution
After a couple of days being p*ssed about the fact that a lot of policies cant be altered using the [Admin SDK API](https://developers.google.com/admin-sdk/reference-overview) I was taking a long, warm shower and suddenly realized that I didn't need to change the policy: I could just move the OU containing the ChromeOS devices to automatically switch between policies. One hour later the script was finished and because (I assume) we can't be the only one with this problem I am now sharing it with you.

# Using The Script

## Prerequisites
+ You are using Google Workspace for Education
+ You have access to the following API Scopes:
  + admin.directory.orgunit
  + admin.directory.device.chromeos
  + calendar
+ Your students have ChromeOS devices
+ The devices are managed in your Workspace environment
+ The devices that need to be switched are placed in an OU
+ You have a Google Calendar with holidays

## Cloning the script

### Using CLASP and Git
Clone the git repo and use [clasp](https://developers.google.com/apps-script/guides/clasp) to create an appsscript file in your google account. Push the contents of the script using clasp.

### Manually
[Create a script from Google Drive](https://developers.google.com/apps-script/guides/projects) and copy the contents of Code.gs into the editor. Go to Project Settings and enable "Show "appsscript.json" manifest file in editor". Copy the contents of appscript.json from the repo to the editor. 

## Before the first run

### Setting the OU Path
Before running the script you need to define the path to the OU containing the chromeOS devices. We had the following OU structure:
```
top-level-domain.com
  ↳Students
    ↳Student Chromebooks
```
*This only shows the relevant OU structure*

In this case, the path to the OU containing the chromebooks is `/Students/Student Chromebooks`. 

In the apps script web editor go to 'Project settings' and scroll down to 'Script properties'. Add a new property called 'ou_path' and set the value to the path to your OU.

#### Want to test it first?
You could create an OU to test the script. Put a chromeos device in this OU and run the script. Afterwards, [undo the changes](https://github.com/Vlietland-College/AutoMoveOU-for-google-workspace/edit/master/README.md#undo-changes) and change the ou_path before running firstRun 'for real'. You can leave the other properties, they are overwritten by firstRun.

### Setting the calendar ID
Find the ID of the Google calendar that the script should use. The ID can be found under 'Integrate calendar' in the calendar settings. Add a script property called 'calendar_id'. 

Make sure the holidays are all-day events in the calendar.

### Setting the regular expresion
In order to determine if the 'holiday' policies should be applied the script the title of every event that is happening within two hours of running the script is matched against a regular expression. If the expression matches, the container OU is moved to the holiday OU (and, if not, to the Normal OU). 

Eg:
We have two types of holidays: the longer ones (they all contain the word 'vacation') and some loose days. The loose days all have '(no lessons)' as part of the title so our regular expression is: 'vacation|(no lessons)'.

Add a script property called 'regex_matcher' containing your regular expression. 

## The first run 
Run the function called 'firstRun' from the apps script editor. You will be asked to grant permission to the script for the scopes mentioned above. After granting the permisson, the following steps are taken:

### Making the OU structure
Two new OU's are created as children of the OU defined in the script properties. The first one is called 'Regular' and the second one 'Vacation'. A third OU is created under 'Regular'. This OU is named after the OU defined plus the word 'Container'. This will hold the actual entities that need to be moved.

Our structure now looks like this:
```
top-level-domain.com
  ↳Students
    ↳Student Chromebooks
      ↳Regular
        ↳Student Chromebooks Container
      ↳Vacation
```

The OU id's are saved as script properties. You should not change these manually. 

### Moving the devices
Every ChromeOS device placed under 'Student Chromebooks' is moved to the container. I have not tested this with large numbers of devices. If the script fails because of the amount of devices you can manually move them in the admin portal.

## Testing 
This is optional but recommended. 

Add a script property called 'debug' with 'true' as value. Add a second property called 'mock_date'. The value of this property should be a DateTime string formatted according to the [ISO 8601 format](https://tc39.es/ecma262/#sec-date-time-string-format), so for example `2023-04-27T04:10`. Set this date to a date that has an event that matches against your regular expression and run 'dailyCheck'. The container OU should be moved to the 'vacation' OU. Set the date to a non-vacation day, run dailyCheck and verify the OU has been placed back into 'Regular'.

Don't forget to either remove the debug property or set the value to false.
 
## Creating the trigger
In the script editor go to 'Triggers' and create a new trigger. Use the following settings:

![Screenshot 2023-02-27 at 14 05 03](https://user-images.githubusercontent.com/4431536/221571212-be08a3d5-4034-4fdd-8ba8-6fb96e53aa42.png)
*If the timezone is not correct go to 'Project settings' and adjust the timezone before creating the trigger*

The script will now run every morning.

# Setting the policy
Since policies are inherited you don't have to change the way you set the regular policies: I highly recommend you keep using the pre-existing OU (Student Chromebooks in our example) or a higher one to enforce policies. The few policies that should be different during the holidays are applied in the 'Vacation' OU. Do not enforce policies at either container or normal level unless you know what you're doing.


# ZTE and enrollment
If you use [zero-touch enrollment tokens](https://support.google.com/chrome/a/answer/10130175?hl=en) you need to create a new token for the container ou. Also change enrollment settings to make sure new student-devices are enrolled in the correct OU.

# Undo changes
There is a function named 'undoChanges' that places all chromeos devices back in the OU defined during firstRun and removes the underlying ou structure.

