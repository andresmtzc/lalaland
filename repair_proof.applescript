-- Single Image Repair — Proof of Concept
-- Flow: open image → add mask layer → load selection → delete mask → repair selection
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

-- Step 4: Delete the mask layer (selection stays active)
tell application "System Events"
	tell process "Pixelmator Pro"
		-- Edit > Delete or backspace to remove the mask layer
		key code 51 -- backspace
		delay 0.3
	end tell
end tell

-- Step 5: Select the Repair tool
tell application "System Events"
	tell process "Pixelmator Pro"
		keystroke "r"
		delay 0.5
	end tell
end tell

-- Step 6: Open Accessibility Inspector and pause so you can find the "Repair Selection" button path
tell application "Accessibility Inspector" to activate
delay 1

display dialog "Accessibility Inspector is open." & return & return & ¬
	"1. Click the target icon (crosshair) in Accessibility Inspector" & return & ¬
	"2. Hover over the \"Repair Selection\" button in Pixelmator Pro" & return & ¬
	"3. Note the element hierarchy shown in the inspector" & return & return & ¬
	"Click OK when done inspecting." buttons {"OK"} default button "OK"

-- Bring Pixelmator back to front
tell application "Pixelmator Pro" to activate
delay 0.3

-- TODO: Replace this with the real element path from Accessibility Inspector
-- Example: click button "Repair Selection" of group X of scroll area Y of window 1
display dialog "Paste the element path here in the script, then re-run." buttons {"OK"} default button "OK"
