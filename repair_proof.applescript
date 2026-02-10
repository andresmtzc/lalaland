-- Single Image Repair — Proof of Concept
-- Flow: open image → add mask layer → load selection → switch to image layer → repair → export
--
-- BEFORE RUNNING:
--   1. System Settings > Privacy & Security > Accessibility → enable Script Editor (or Terminal)
--   2. Run: osascript repair_proof.applescript

-- Pick files
set imageFile to choose file with prompt "Select the image to repair:" of type {"public.image"}
set maskFile to choose file with prompt "Select the mask PNG (transparent = keep, opaque = repair):" of type {"public.image"}

-- Step 1: Open the image
tell application "Pixelmator Pro"
	activate
	open imageFile
	delay 1
end tell

-- Step 2: Add mask as a new layer (open, copy, paste approach)
tell application "Pixelmator Pro"
	open maskFile
	delay 0.5
	tell front document
		select all
		copy
	end tell
	close front document without saving
	delay 0.3
	-- Paste into the original image — creates a new layer
	tell front document
		paste
	end tell
	delay 0.5
end tell

-- Step 3: Load Selection from the mask layer (alpha/transparency)
tell application "System Events"
	tell process "Pixelmator Pro"
		set frontmost to true
		delay 0.3
		click menu item "Load Selection" of menu "Edit" of menu bar 1
		delay 0.5
	end tell
end tell

-- Step 4: Select the image layer (bottom layer) via native scripting
tell application "Pixelmator Pro"
	tell front document
		set current layer to last layer
	end tell
	delay 0.3
end tell

-- Step 5: Select the Repair tool
tell application "System Events"
	tell process "Pixelmator Pro"
		keystroke "r"
		delay 0.5
	end tell
end tell

-- Step 6: Click "Repair Selection" in the tool options panel
tell application "System Events"
	tell process "Pixelmator Pro"
		click button "Repair Selection" of group 1 of group 2 of window 1
		delay 2
	end tell
end tell

-- Step 7: Deselect
tell application "Pixelmator Pro"
	tell front document
		deselect
	end tell
end tell

-- Step 8: Hide the mask layer and export
-- Build export path: same folder as original, with "_repaired" suffix
set imagePath to POSIX path of imageFile
set AppleScript's text item delimiters to "."
set pathParts to text items of imagePath
set ext to last item of pathParts
set basePath to (items 1 thru -2 of pathParts) as text
set AppleScript's text item delimiters to ""
set exportPath to basePath & "_repaired." & ext
set exportFile to POSIX file exportPath

tell application "Pixelmator Pro"
	tell front document
		-- Hide the mask layer (layer 1 = topmost)
		set visible of layer 1 to false
	end tell
	delay 0.3
	-- Export in the same format as the original
	if ext is "jpg" or ext is "jpeg" or ext is "JPG" or ext is "JPEG" then
		export front document to exportFile as JPEG with properties {quality:95}
	else
		export front document to exportFile as PNG
	end if
	delay 0.5
	close front document without saving
end tell

display dialog "Done! Exported to:" & return & exportPath buttons {"OK"} default button "OK"
