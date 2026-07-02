import AVFoundation
import CoreImage
import AppKit

// Decode HEVC+alpha via AVAssetReader (VideoToolbox, same stack as iOS)
// and report alpha statistics + dump sample frames as PNG.
let args = CommandLine.arguments
guard args.count >= 2 else { print("usage: verify <file.mov>"); exit(1) }
let url = URL(fileURLWithPath: args[1])
let name = url.deletingPathExtension().lastPathComponent

let asset = AVAsset(url: url)
guard let track = asset.tracks(withMediaType: .video).first else {
    print("\(name): NO VIDEO TRACK"); exit(2)
}
if let desc = track.formatDescriptions.first {
    let d = desc as! CMFormatDescription
    let ext = CMFormatDescriptionGetExtension(d, extensionKey: kCMFormatDescriptionExtension_ContainsAlphaChannel)
    print("\(name): containsAlphaChannel ext = \(String(describing: ext))")
}

let reader = try! AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
])
reader.add(output)
reader.startReading()

var frameIdx = 0
while let sb = output.copyNextSampleBuffer() {
    guard let pb = CMSampleBufferGetImageBuffer(sb) else { continue }
    CVPixelBufferLockBaseAddress(pb, .readOnly)
    let w = CVPixelBufferGetWidth(pb), h = CVPixelBufferGetHeight(pb)
    let stride = CVPixelBufferGetBytesPerRow(pb)
    let base = CVPixelBufferGetBaseAddress(pb)!.assumingMemoryBound(to: UInt8.self)
    var transparent = 0, opaque = 0, partial = 0
    for y in 0..<h {
        for x in 0..<w {
            let a = base[y*stride + x*4 + 3]
            if a < 10 { transparent += 1 } else if a > 245 { opaque += 1 } else { partial += 1 }
        }
    }
    let total = w*h
    if frameIdx % 10 == 0 || frameIdx < 2 {
        print("\(name) f\(frameIdx) \(w)x\(h): transparent \(100*transparent/total)% opaque \(100*opaque/total)% partial \(100*partial/total)%")
    }
    if frameIdx == 0 || frameIdx == 10 {
        let ci = CIImage(cvPixelBuffer: pb)
        let ctx = CIContext()
        if let cg = ctx.createCGImage(ci, from: ci.extent) {
            let rep = NSBitmapImageRep(cgImage: cg)
            if let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: "hevc/out/verify_\(name)_f\(frameIdx).png"))
            }
        }
    }
    CVPixelBufferUnlockBaseAddress(pb, .readOnly)
    frameIdx += 1
}
print("\(name): decoded \(frameIdx) frames, reader status \(reader.status.rawValue)")
