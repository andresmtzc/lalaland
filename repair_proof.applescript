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

-- Step 5: Select the Repair tool and click "Repair Selection"
tell application "System Events"
	tell process "Pixelmator Pro"
		-- Open the Repair tool — try keyboard shortcut first
		-- In Pixelmator Pro, Repair tool shortcut is typically "R"
		keystroke "r"
		delay 0.5

		-- Click "Repair Selection" button in the tool options (right panel)
		-- This is the ML inpaint on the current selection
		try
			click button "Repair Selection" of group 1 of scroll area 1 of group 1 of window 1
		on error
			-- If that path doesn't work, try clicking by name anywhere in the window
			try
				click button "Repair Selection" of window 1
			on error
				-- Last resort: look for it in the tool options bar
				try
					click button "Repair Selection" of toolbar 1 of window 1
				end try
			end try
		end try
		delay 2
	end tell
end tell

-- Step 6: Deselect
tell application "Pixelmator Pro"
	tell front document
		deselect
	end tell
end tell

display dialog "Done! Check the image in Pixelmator Pro." buttons {"OK"} default button "OK"
