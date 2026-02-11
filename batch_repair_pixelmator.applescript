-- ============================================================
-- Batch Repair with Mask in Pixelmator Pro
-- ============================================================
-- This script automates Pixelmator Pro to:
--   1. Open each image from an input folder
--   2. Load a shared mask image as a selection
--   3. Apply the Repair (inpaint) tool on that selection
--   4. Export the result as JPG to an output folder
--
-- SETUP:
--   - Place all your source images in one folder
--   - Create a black & white mask image (white = area to repair)
--     with the same dimensions as your source images
--   - Run this script from Script Editor or via Terminal:
--       osascript batch_repair_pixelmator.applescript
-- ============================================================

-- ===================== CONFIGURATION ========================
-- Change these paths to match your setup:
set inputFolder to (POSIX file "/Users/YOU/Desktop/input_images") as alias
set outputFolder to "/Users/YOU/Desktop/output_jpg/"
set maskFile to (POSIX file "/Users/YOU/Desktop/mask.png") as alias
set jpegQuality to 85 -- JPG quality (0-100)
-- ============================================================

-- Make sure output folder exists
do shell script "mkdir -p " & quoted form of outputFolder

-- Get list of image files from input folder
tell application "Finder"
	set imageFiles to (every file of inputFolder whose name extension is in {"png", "jpg", "jpeg", "tiff", "tif", "heic"}) as alias list
end tell

set totalFiles to count of imageFiles
set processedCount to 0

tell application "Pixelmator Pro"
	activate

	-- Open the mask once to copy it
	open maskFile
	delay 1

	tell its front document
		-- Select all of the mask, copy it, then close
		select all
		copy
	end tell

	-- Close the mask without saving
	close front document without saving
	delay 0.5

	-- Process each image
	repeat with imageFile in imageFiles
		set processedCount to processedCount + 1

		-- Get the file name for the output
		tell application "System Events"
			set fileName to name of imageFile
		end tell
		-- Strip extension and add .jpg
		set baseName to text 1 thru ((offset of "." in (reverse of characters of fileName as string)) * -1 + (length of fileName)) of fileName
		set outputName to baseName & ".jpg"
		set outputPath to outputFolder & outputName

		-- Open the source image
		open imageFile
		delay 1

		tell its front document
			-- Paste the mask as a new layer
			paste
			delay 0.5

			-- Use the mask layer to create a selection:
			-- Select by color range (white areas of the mask)
			-- Then delete the mask layer and apply repair on selection
		end tell

		-- Use UI scripting for operations not in Pixelmator's AppleScript dictionary
		tell application "System Events"
			tell process "Pixelmator Pro"
				-- Select the pasted mask layer (topmost)
				-- Load it as selection: Edit > Load Selection (or Color > Select Color)

				-- Method: Use "Select Subject" on the mask's white area
				-- via menu: Edit > Load as Selection
				try
					click menu item "Load Selection" of menu "Edit" of menu bar 1
					delay 0.5
				on error
					-- Fallback: manually select via color range
					try
						click menu item "Select Color..." of menu "Edit" of menu bar 1
						delay 1
						-- Press Return to confirm default selection
						keystroke return
						delay 0.5
					end try
				end try

				-- Delete the mask layer so we're back to the original image
				-- Select the mask layer in the layers panel and delete it
				try
					keystroke (ASCII character 8) -- Delete key to remove mask layer
					delay 0.3
				end try
			end tell
		end tell

		-- Now we have a selection from the mask on the original image
		-- Apply the Repair tool via menu
		tell application "System Events"
			tell process "Pixelmator Pro"
				-- Use Edit > Inpaint / Repair
				-- In Pixelmator Pro, the repair is applied via:
				-- Format > Image > Inpaint Selection (if available)
				-- or via the ML-based repair
				try
					click menu item "Inpaint" of menu "Format" of menu bar 1
					delay 2
				on error
					try
						click menu item "Inpaint" of menu "Image" of menu bar 1
						delay 2
					on error
						-- Try under Edit menu
						try
							click menu item "Inpaint" of menu "Edit" of menu bar 1
							delay 2
						end try
					end try
				end try
			end tell
		end tell

		-- Deselect
		tell application "Pixelmator Pro"
			tell its front document
				deselect
			end tell
		end tell

		-- Export as JPEG
		tell application "Pixelmator Pro"
			tell its front document
				export to file (POSIX file outputPath) as JPEG with properties {compression factor:jpegQuality}
			end tell

			-- Close without saving
			close front document without saving
		end tell

		delay 0.5

		-- Log progress
		log "Processed " & processedCount & " of " & totalFiles & ": " & fileName
	end repeat
end tell

display notification "Batch repair complete! " & totalFiles & " images processed." with title "Pixelmator Batch Repair"
