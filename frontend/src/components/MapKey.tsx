import '../map-key.css'

/** An "i" button in the toolbar. The explanation shows only while it is hovered or focused. */
export default function MapKey() {
  return (
    <div className="mk-wrap">
      <button aria-label="What the map shows" aria-describedby="mk-pop" style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>i</button>
      <div className="mk-pop card" id="mk-pop" role="tooltip">
        <p><i className="mk-hex" /><span><b>Hexagon</b> is the model's estimate: forecast PM2.5 as an AQI for the hour on the timeline.</span></p>
        <p><i className="mk-st" /><span><b>Circle</b> is a real monitoring station. Its colour is its latest real reading, so it is measured, not predicted. Click one to check it on OpenAQ.</span></p>
      </div>
    </div>
  )
}
