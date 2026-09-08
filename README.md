# FieldVisit Pro

Create a complete responsive web application named “Mehar DVR” (Daily Visit Report) for employee field visits.

The main purpose of this website is to verify that employees are physically present near approved visit locations, allow them to capture a live photo, show the correct fixed location on the photo, and record the purpose of the visit.

Main Workflow

Admin will add around 20 fixed locations in the system.

Each location should contain:

Location Name

Full Address

Latitude

Longitude

Allowed Radius

Default Radius: 100 meters

Location Code

Active / Inactive Status

Example:

HDFC Bank – Vaishali Nagar
Latitude: 26.xxxxxx
Longitude: 75.xxxxxx
Allowed Radius: 100 meters

Employee Visit Process

When an employee goes for a visit:

Employee logs in.

Employee sees assigned visit locations.

Employee selects a location or the system detects the nearest assigned location automatically.

Website asks for live GPS permission.

Fetch current employee latitude and longitude.

Calculate distance from the fixed location.

If employee is within 100 meters, show:

✓ You are inside the allowed visit location

If employee is outside 100 meters, show:

You are outside the allowed location. Please reach within 100 meters.

Enable the camera only when the employee is inside the allowed radius.

Employee must select the Visit Purpose.

Employee captures a live photo.

Add location, purpose, date, time, employee and GPS details directly on the photo.

Employee submits the visit.

Save the visit in the Admin Dashboard.

Very Important Fixed Location Rule

Do not show random Google Maps place names, nearby shops, roads, buildings or other automatically detected place names on the photo.

The main location name on the photo must always come from the fixed location saved by Admin.

Example:

If Admin creates:

HDFC Bank – Vaishali Nagar

and the employee is within 100 meters of that fixed GPS point, the captured photo must show:

Location: HDFC Bank – Vaishali Nagar

It should never change to a nearby shop or another Google Maps business name.

For each of the 20 locations, detect which fixed location the employee is currently within and use that exact saved location name.

Visit Purpose

Before taking the photo, show a required field:

What is the purpose of this visit?

Provide options:

Customer Meeting

Document Collection

Document Submission

Bank Visit

RTO Visit

Dealer Visit

Broker Visit

Payment Follow-up

Loan Case Follow-up

Verification

Collection Visit

Office Work

Other

If employee selects Other, show:

Enter Visit Purpose

Also add an optional:

Remarks / Notes

field.

Visit Purpose must be mandatory.

Live Camera

Use mobile live camera.

Prefer back camera.

Do not use normal gallery upload as the primary method.

Buttons:

Open Camera

Capture Photo

Retake Photo

Submit Visit

Camera button should only be enabled after:

GPS is available

Employee is within allowed radius

Visit Purpose is selected

Photo Location Watermark

After photo capture, automatically add a professional watermark/overlay directly on the image.

Example:

MEHAR DVR

Location: HDFC Bank – Vaishali Nagar
Visit Purpose: Document Collection
Employee: Sumit Sharma
Employee ID: MEH001
Date: 18 Aug 2026
Time: 05:35 PM
Distance: 34 meters
GPS Accuracy: ±10 meters
Latitude: 26.xxxxxx
Longitude: 75.xxxxxx

The watermark must become a permanent part of the saved photo.

Use a semi-transparent dark bottom overlay with clean white text so the details are clearly readable.

The most important fields should be:

Location Name + Visit Purpose + Employee + Date + Time

GPS Accuracy

Fetch device GPS accuracy.

Show:

GPS Accuracy: ±12 meters

If GPS accuracy is poor, for example above 50 meters, show:

GPS accuracy is low. Please move to an open area and try again.

Do not allow submission with very poor GPS accuracy.

Distance Calculation

Use the Haversine Formula to calculate the distance between:

Fixed location latitude/longitude

Employee current latitude/longitude

If:

distance <= allowed radius

Allow photo capture.

If:

distance > allowed radius

Block photo capture and visit submission.

Distance validation must also happen on the backend.

Do not trust only frontend validation.

Mobile Visit Screen

Create a simple mobile-first visit page showing:

Visit Location
HDFC Bank – Vaishali Nagar

Allowed Radius
100 meters

Your Distance
34 meters

GPS Accuracy
±10 meters

Green status:

✓ Location Verified

Then:

Visit Purpose

Dropdown

Then:

Remarks

Then large button:

Open Camera

After capture show photo preview and:

Retake Photo

Submit Visit

Employee Dashboard

Create an employee dashboard with:

Today's Visits

Pending Visits

Completed Visits

Assigned Locations

Visit History

Search

Date Filter

Location Filter

Visit history should show:

Photo

Location Name

Visit Purpose

Date

Time

Distance

Status

View Details

Admin Dashboard

Create a complete Admin Dashboard.

Admin should be able to:

Add Location

Edit Location

Delete Location

Activate / Deactivate Location

Set Latitude

Set Longitude

Set Radius

Assign Location to Employees

Manage Employees

View All DVR Visits

View Employee Photos

View Visit Purpose

View Remarks

View Actual GPS Coordinates

View Distance from Fixed Location

Search Employee

Search Location

Search Visit Purpose

Filter by Date

Filter by Status

Export DVR Report

Add Location Page

Create an Admin location setup page with:

Location Name

Location Code

Address

Latitude

Longitude

Allowed Radius

Active / Inactive

Add a map.

Admin should be able to click a point on the map and automatically fill latitude and longitude.

Show a visible 100-meter radius circle around the location.

Map Dashboard

Show all fixed locations on a map.

Each pin should show:

Location Name

Address

Radius

Status

Total Visits

Visit Detail Page

Every DVR visit should have a detailed page showing:

Employee Name

Employee ID

Captured Photo

Fixed Location

Visit Purpose

Remarks

Visit Date

Visit Time

Actual Latitude

Actual Longitude

Fixed Latitude

Fixed Longitude

Distance

GPS Accuracy

Visit Status

Also show a map with:

Fixed location marker

Actual employee capture marker

Roles

Create two roles:

Admin

Admin can:

Manage Employees

Manage Locations

Assign Locations

View All Visits

View Photos

View Reports

Export Data

Employee

Employee can:

View Assigned Locations

Start Visit

Verify GPS

Select Visit Purpose

Capture Live Photo

Submit Visit

View Own Visit History

Login Page

Create a clean professional login page.

Brand:

MEHAR DVR
Daily Visit Report

Fields:

Employee ID / Email

Password

Remember Me

Forgot Password

Login

Database Structure

Create proper tables for:

users

id

name

email

employee_id

password

role

status

locations

id

location_name

location_code

address

latitude

longitude

allowed_radius

status

created_at

employee_location_assignments

id

employee_id

location_id

visits

id

employee_id

location_id

visit_purpose

remarks

actual_latitude

actual_longitude

fixed_latitude

fixed_longitude

distance

gps_accuracy

photo_url

visit_date

visit_time

status

created_at

Security

Add proper validation.

Important rules:

Employee cannot manually change the fixed location name.

Location shown on photo must come from the database.

Validate GPS on frontend and backend.

Do not allow submission outside the allowed radius.

Store actual GPS coordinates.

Store server date/time.

Prevent accidental duplicate submissions.

Employee should not be able to modify photo watermark details.

Prefer live camera instead of gallery upload.

UI Design

Use a modern corporate UI suitable for Mehar Advisory.

Design style:

White background

Sky blue / professional blue accents

Modern cards

Clean sidebar

Rounded corners

Soft shadows

Responsive layout

Mobile-first design

Professional icons

Clean tables

Simple animations

The Employee Visit screen should be extremely easy to use from a mobile phone.

Tech Stack

Use:

React

TypeScript

Tailwind CSS

Supabase for authentication, database and storage if needed

Browser Geolocation API

Camera API

Modern responsive PWA-style interface

Use realistic demo data for at least 20 locations and multiple employees.

The final application should feel like a real production-ready Mehar DVR Employee Field Visit Management System, not just a dashboard mockup.

Most important functionality:

Fixed Admin Location → Employee comes within 100 meters → GPS verifies location → Employee selects Visit Purpose → Live photo capture → Exact fixed location and Visit Purpose appear on photo → Visit is submitted and saved in DVR dashboard.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/824eaf47-3de1-4121-9a65-c25000695fe2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
