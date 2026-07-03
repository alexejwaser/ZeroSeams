## Current Problem

The mask functionality currently feels "stuck on" and unintuitive. Several issues make it difficult to use effectively:

- **Unpredictable behavior when scaling/transforming**: When masked media is scaled or transformed, the outcome doesn't follow clear, predictable rules
- **No clear behavior rules**: How masks should behave based on crop mode or auto-fill mode is not well-defined or intuitive
- **Limited implementation approach**: Drawing masks directly on individual elements is restrictive and doesn't align with industry-standard design tools

## Proposed Direction

Instead of the current approach, consider a shape-based masking system (similar to InDesign):

1. **User creates a shape** using the pen tool or basic shapes
2. **User inserts media into the shape** - the shape becomes a "frame" that contains the image/video
3. **Every shape could theoretically become a frame layer**
4. **Media replacement options**: Users can easily:
   - Remove the image/video and replace it with different media
   - Replace media with solid colors
   - Replace media with gradients

## Benefits

- More intuitive interaction model aligned with industry-standard tools
- Clear, predictable behavior based on shape boundaries
- Powerful yet simple - shapes define the container, media fits within it
- Better scalability - transforming the shape automatically affects contained media appropriately

## Critical Considerations

### Smart Guides & Alignment
- Ensure snapping to **smart guides** and **custom guidelines** continues to work seamlessly with frame layers
- Content within frames should participate in guide snapping relative to both:
  - The frame boundaries (for alignment within the container)
  - Global canvas guides (for alignment across the document)
- Maintain current snapping behavior and responsiveness

### Content-Frame Relationship Consistency
- The relationship between content layers and their containing frame layer must be **consistent across all use cases**:
  - Scaling the frame should scale contained media predictably (maintain aspect ratio or fill frame based on settings)
  - Rotating/skewing the frame should transform contained media appropriately
  - Moving the frame should move all contained media with it
  - Content bounding box should always respect frame boundaries
- Define clear transformation rules that apply uniformly, regardless of how the frame was created or what media it contains

### Leverage Existing Grid System
- ZeroSeams already has a **premade grids system** for layout (e.g., column grids, spacing grids)
- **Investigate whether this new frame-based system can reuse, extend, or replace the existing grid infrastructure**
- Potential synergies:
  - Frames could support grid-based snapping similar to premade grids
  - Grid presets could define frame templates
  - Content inside frames could snap to grid divisions
  - Consider unifying the conceptual model: frames as adaptive grids, grids as reusable frame templates

## Research & Exploration

This issue is open for exploration. We need to research and evaluate different approaches to find the optimal way to implement masking that is:
- **Simple** for basic use cases
- **Powerful** for advanced use cases
- **Predictable** in behavior
- **Consistent** with common design tool patterns
- **Well-integrated** with existing smart guide and grid systems

Please investigate:
- How other design tools (Figma, InDesign, Adobe XD) implement frame/shape masking
- How snapping and guides interact with frames/masks in industry tools
- Current smart guide implementation in ZeroSeams and compatibility with frames
- Existing grid system architecture and opportunities for unification
- Technical feasibility of different masking implementations
- Interaction patterns and UX considerations
- Impact on current codebase and existing mask functionality
- Performance implications of shape-based vs. current element-based masking
