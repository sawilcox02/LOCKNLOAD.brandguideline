// LOCKNLOAD Brand Guidelines - InDesign book setup
// Builds a new document with the book's trim, bleed, masters, 12-column grid,
// row guides, ring-hole guides, swatches, layers and paragraph styles.
// Run: Window > Utilities > Scripts, right-click "User" > Reveal in Finder/Explorer,
// drop this file in, then double-click it in the Scripts panel.

#target indesign
(function () {
    var TW = 12, TH = 6.75, BL = 0.125, SLUG = 0.75;
    var BIND = 0.875, M = 0.5, G = 0.1875, COLS = 12, ROWS = 6;
    var COL = (TW - 2 * M - (COLS - 1) * G) / COLS;
    var LIVEH = TH - BIND - M;
    var ROW = (LIVEH - (ROWS - 1) * G) / ROWS;
    var HOLES = [1.75, 6, 10.25], HOLE_D = 0.3125, HOLE_C = 0.375;
    var missing = [];

    var oldUnits = app.scriptPreferences.measurementUnit;
    app.scriptPreferences.measurementUnit = MeasurementUnits.INCHES;

    var doc = app.documents.add();
    try {
        with (doc.documentPreferences) {
            facingPages = false;
            pageWidth = TW;
            pageHeight = TH;
            documentBleedUniformSize = true;
            documentBleedTopOffset = BL;
            documentSlugUniformSize = true;
            slugTopOffset = SLUG;
        }
        doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
        doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.INCHES;
        doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;

        // Baseline grid: 13.5 pt, equal to the gutter
        with (doc.gridPreferences) {
            baselineDivision = "13.5pt";
            try { baselineGridRelativeOption = BaselineGridRelativeOption.TOP_OF_MARGIN_OF_PAGE; } catch (e) {}
            baselineStart = 0;
            baselineGridShown = false;
        }

        // ---------- swatches (exact RGB brand values) ----------
        function swatch(name, rgb) {
            var c = doc.colors.itemByName(name);
            if (c.isValid) return c;
            c = doc.colors.add({ name: name, model: ColorModel.PROCESS, space: ColorSpace.RGB, colorValue: rgb });
            return c;
        }
        var PULSE = swatch("Pulse Violet #9C26F0", [156, 38, 240]);
        var SHADOW = swatch("Shadow Alloy #211F2D", [33, 31, 45]);
        var FROST = swatch("Frost Signal #EEF1F9", [238, 241, 249]);
        var IGN = swatch("Ignition Orange #FF7514", [255, 117, 20]);
        var SURGE = swatch("Surge Green #91E829", [145, 232, 41]);
        var PAPER = doc.swatches.itemByName("Paper");

        // ---------- layers ----------
        var baseLayer = doc.layers[0]; baseLayer.name = "Text";
        function layer(name, printable, color) {
            var l = doc.layers.add({ name: name });
            l.printable = printable;
            try { l.layerColor = color; } catch (e) {}
            return l;
        }
        var lImages = layer("Images", true, UIColors.GREEN);
        var lBg = layer("Background", true, UIColors.GRAY);
        var lRing = layer("Ring Zone (non-printing)", false, UIColors.RED);
        // order: Ring zone top, Text, Images, Background bottom
        lRing.move(LocationOptions.AT_BEGINNING);
        lBg.move(LocationOptions.AT_END);
        lImages.move(LocationOptions.BEFORE, lBg);

        // ---------- fonts + paragraph styles ----------
        function findFont(family, style) {
            var f = app.fonts.itemByName(family + "\t" + style);
            return f.isValid ? f : null;
        }
        function font(family, style) {
            var f = findFont(family, style);
            if (!f) missing.push(family + " " + style);
            return f;
        }
        var BCB = font("BC Barell", "Extended Black");
        var ADR = font("Address Sans Pro", "Regular");
        var ADR_B = findFont("Address Sans Pro", "Bold") || findFont("Address Sans Pro", "SemiBold") || findFont("Address Sans Pro", "Medium") || ADR;

        function pstyle(name, props, f) {
            var s = doc.paragraphStyles.itemByName(name);
            if (!s.isValid) s = doc.paragraphStyles.add({ name: name });
            if (f) { try { s.appliedFont = f; } catch (e) {} }
            for (var k in props) { try { s[k] = props[k]; } catch (e) {} }
            return s;
        }
        var base = { justification: Justification.LEFT_ALIGN, hyphenation: false, fillColor: SHADOW };
        function extend(o) { var r = {}; for (var k in base) r[k] = base[k]; for (var j in o) r[j] = o[j]; return r; }
        pstyle("Display 1", extend({ pointSize: "56pt", leading: "51.5pt", capitalization: Capitalization.ALL_CAPS }), BCB);
        pstyle("Display 2", extend({ pointSize: "28pt", leading: "26pt", capitalization: Capitalization.ALL_CAPS, spaceAfter: "6.75pt" }), BCB);
        pstyle("Label", extend({ pointSize: "8pt", leading: "9.6pt", tracking: 50, capitalization: Capitalization.ALL_CAPS }), BCB);
        pstyle("Kicker", extend({ pointSize: "8pt", leading: "10pt", tracking: 160, capitalization: Capitalization.ALL_CAPS, spaceAfter: "5pt" }), ADR_B);
        pstyle("Lead", extend({ pointSize: "14pt", leading: "20.25pt", spaceAfter: "6.75pt", alignToBaseline: true }), ADR);
        pstyle("Body", extend({ pointSize: "10pt", leading: "13.5pt", spaceAfter: "6.75pt", alignToBaseline: true }), ADR);
        pstyle("Caption", extend({ pointSize: "7.5pt", leading: "10pt" }), ADR);
        pstyle("Info Line", extend({ pointSize: "6.5pt", leading: "8pt", tracking: 140, capitalization: Capitalization.ALL_CAPS }), ADR_B);
        pstyle("Section Code", extend({ pointSize: "6.5pt", leading: "8pt", tracking: 140, fillColor: PULSE, justification: Justification.RIGHT_ALIGN }), ADR_B);

        // ---------- masters ----------
        var mA = doc.masterSpreads[0];
        mA.namePrefix = "A"; mA.baseName = "Visual";
        var mB = doc.masterSpreads.add(1, { namePrefix: "B", baseName: "Copy" });

        function setupMaster(ms, ringAtTop, dark) {
            var p = ms.pages[0];
            with (p.marginPreferences) {
                top = ringAtTop ? BIND : M;
                bottom = ringAtTop ? M : BIND;
                left = M; right = M;
                columnCount = COLS;
                columnGutter = G;
            }
            var topM = ringAtTop ? BIND : M;
            // row guides (top and bottom of each row gutter)
            for (var r = 1; r < ROWS; r++) {
                var y = topM + r * ROW + (r - 1) * G;
                p.guides.add(baseLayer, { orientation: HorizontalOrVertical.HORIZONTAL, location: y });
                p.guides.add(baseLayer, { orientation: HorizontalOrVertical.HORIZONTAL, location: y + G });
            }
            // ring hole guides + non-printing hole marks
            var hy = ringAtTop ? HOLE_C : TH - HOLE_C;
            for (var h = 0; h < HOLES.length; h++) {
                p.guides.add(lRing, { orientation: HorizontalOrVertical.VERTICAL, location: HOLES[h] });
                var o = p.ovals.add(lRing, { geometricBounds: [hy - HOLE_D / 2, HOLES[h] - HOLE_D / 2, hy + HOLE_D / 2, HOLES[h] + HOLE_D / 2] });
                o.strokeColor = "Black"; o.strokeWeight = "0.5pt"; o.fillColor = "None";
            }
            p.guides.add(lRing, { orientation: HorizontalOrVertical.HORIZONTAL, location: hy });
            var zone = ringAtTop ? [0, 0, BIND, TW] : [TH - BIND, 0, TH, TW];
            var z = p.rectangles.add(lRing, { geometricBounds: zone });
            z.fillColor = "None"; z.strokeColor = "Black"; z.strokeWeight = "0.25pt"; try { z.strokeType = "Dashed"; } catch (e) {}
            // background for dark masters
            if (dark) {
                var bg = p.rectangles.add(lBg, { geometricBounds: [-BL, -BL, TH + BL, TW + BL] });
                bg.fillColor = SHADOW; bg.strokeColor = "None";
            }
            // info line (inside trim, 0.2in from free edge)
            var iy = ringAtTop ? TH - 0.2 - 0.06 : 0.2 - 0.06;
            function info(x1, x2, txt, style) {
                var t = p.textFrames.add(baseLayer, { geometricBounds: [iy, x1, iy + 0.14, x2], contents: txt });
                t.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.itemByName(style);
                if (dark) t.paragraphs[0].fillColor = PAPER;
                if (style === "Section Code") t.paragraphs[0].fillColor = PULSE;
                t.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN;
                return t;
            }
            info(M, M + 4, "LOCKNLOAD \u00B7 Brand Guidelines", "Info Line");
            var c = info(TW / 2 - 2, TW / 2 + 2, "Chapter name", "Info Line");
            c.paragraphs[0].justification = Justification.CENTER_ALIGN;
            info(TW - M - 2, TW - M, "00.0", "Section Code");
        }
        setupMaster(mA, false, false);
        setupMaster(mB, true, false);
        var mC = doc.masterSpreads.add(2, { namePrefix: "C", baseName: "Visual Dark" }); setupMaster(mC, false, true);
        var mD = doc.masterSpreads.add(3, { namePrefix: "D", baseName: "Copy Dark" }); setupMaster(mD, true, true);

        // ---------- starter pages in print order: B, A, B, A ----------
        doc.pages[0].appliedMaster = mB;
        var p2 = doc.pages.add(); p2.appliedMaster = mA;
        var p3 = doc.pages.add(); p3.appliedMaster = mB;
        var p4 = doc.pages.add(); p4.appliedMaster = mC;

        doc.layers.itemByName("Text").locked = false;
        doc.activeLayer = baseLayer;
    } catch (err) {
        alert("Setup stopped: " + err + (err.line ? " (line " + err.line + ")" : ""));
    }
    app.scriptPreferences.measurementUnit = oldUnits;

    var msg = "LOCKNLOAD book document created.\n\nMasters: A-Visual (rings at bottom), B-Copy (rings at top), C-Visual Dark, D-Copy Dark.\nPages run B, A, B, A to match the print order.";
    if (missing.length) msg += "\n\nFonts not found, so styles use the default font:\n- " + missing.join("\n- ") + "\nActivate them in Creative Cloud > Fonts, then open each paragraph style and set the font.";
    alert(msg);
})();
