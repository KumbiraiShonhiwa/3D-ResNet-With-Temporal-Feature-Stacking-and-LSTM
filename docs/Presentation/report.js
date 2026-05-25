const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, LevelFormat, PageNumber, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

const CONTENT_WIDTH = 9026; // A4 with 1-inch margins

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const headerBorder = { style: BorderStyle.SINGLE, size: 1, color: "2E75B6" };
const headerBorders = { top: headerBorder, bottom: headerBorder, left: headerBorder, right: headerBorder };

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 160 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text, font: "Arial", size: 22, ...opts })],
  });
}

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: "2E75B6" })],
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: "1F4E79" })],
  });
}

function blank() {
  return new Paragraph({ spacing: { after: 80 }, children: [new TextRun("")] });
}

function ref(text) {
  return new Paragraph({
    spacing: { after: 140 },
    indent: { left: 720, hanging: 720 },
    children: [new TextRun({ text, font: "Arial", size: 20 })],
  });
}

// Summary table
const colWidths = [2000, 1400, 1200, 1400, 1600, 1426];
function makeRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders: isHeader ? headerBorders : borders,
      width: { size: colWidths[i], type: WidthType.DXA },
      shading: isHeader
        ? { fill: "2E75B6", type: ShadingType.CLEAR }
        : { fill: "FFFFFF", type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({
          text,
          font: "Arial",
          size: 19,
          bold: isHeader,
          color: isHeader ? "FFFFFF" : "000000"
        })]
      })]
    }))
  });
}

const summaryTable = new Table({
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  columnWidths: colWidths,
  rows: [
    makeRow(['Model', 'Conv Blocks', 'Batch Norm', 'Dropout', 'Params (approx.)', 'Test Acc (%)'], true),
    makeRow(['A – Baseline', '1', 'No', 'No', '~814 K', '98.52']),
    makeRow(['B – Medium', '2', 'Yes', 'No', '~870 K', '99.12']),
    makeRow(['C – Fine-Tuned', '3', 'Yes', 'Yes (0.4)', '~630 K', '99.42']),
  ]
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    children: [

      // Title block
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 120 },
        children: [new TextRun({ text: "Handwritten Digit Classification Using Convolutional Neural Networks on the MNIST Dataset", font: "Arial", size: 36, bold: true, color: "1F4E79" })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: "Technical Report", font: "Arial", size: 24, color: "595959", italics: true })]
      }),
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 1 } },
        spacing: { after: 400 },
        children: [new TextRun("")]
      }),

      // 1. Introduction
      heading1("1. Introduction"),
      para("Handwritten digit recognition is one of the foundational problems in computer vision and machine learning. The ability to automatically classify handwritten numerals has significant real-world utility, underpinning postal sorting systems, bank cheque processing, form digitisation, and more broadly, the recognition of handwritten characters in mobile and embedded devices. Despite appearing conceptually simple, the task presents genuine challenges: individual handwriting styles vary substantially, digit strokes differ in thickness and curvature, and images contain noise introduced by scanning or photography."),
      para("The Modified National Institute of Standards and Technology (MNIST) dataset, first published by LeCun et al. (1998), has served as the canonical benchmark for evaluating image classification algorithms for over two decades. It comprises 70,000 greyscale images of handwritten digits (0–9), each 28×28 pixels, drawn from a mixture of Census Bureau employees and high school students. Its accessibility, modest size, and well-understood difficulty have made it the standard entry point for practitioners exploring deep learning for image recognition."),
      para("This project investigates the progressive design and refinement of Convolutional Neural Networks (CNNs) for MNIST digit classification. Three architectures of increasing complexity are developed: a shallow Baseline model (Model A), a deeper medium model with batch normalisation (Model B), and a fine-tuned deep model incorporating dropout regularisation (Model C). The motivation is not merely to achieve high accuracy — a well-known quantity for MNIST — but to understand how specific architectural decisions and regularisation strategies affect learning dynamics, generalisation, and robustness. All experiments are implemented in PyTorch and trained under a consistent experimental protocol to ensure fair comparison."),

      // 2. Literature Review
      heading1("2. Literature Review"),
      para("The foundational contribution to CNN-based digit recognition is the LeNet-5 architecture introduced by LeCun et al. (1998). LeNet-5 demonstrated that locally connected convolutional layers with shared weights could exploit the spatial structure of images far more efficiently than fully connected networks, achieving a test error rate below 1% on MNIST. This work established the template of alternating convolution and pooling layers followed by fully connected classifiers, a design paradigm that remains prevalent."),
      para("The theoretical underpinnings of deep networks were significantly advanced by Glorot and Bengio (2010), who identified the vanishing gradient problem in deep architectures trained with saturating activations. Their recommendation to use the Rectified Linear Unit (ReLU) activation function has been near-universally adopted, and ReLU is used throughout the present models. Ioffe and Szegedy (2015) introduced Batch Normalisation, demonstrating that normalising layer inputs during training reduces internal covariate shift, accelerates convergence, and allows higher learning rates. Model B and Model C both incorporate batch normalisation following this rationale."),
      para("Srivastava et al. (2014) proposed dropout as a regularisation method to prevent overfitting in neural networks. By randomly zeroing neuron activations during training, dropout forces the network to learn redundant representations and acts as an ensemble of thinned networks. Their experiments showed significant reductions in test error across multiple benchmarks. Model C applies dropout at a rate of 0.4 in the fully connected layers to leverage this effect."),
      para("More recent work by He et al. (2016) on residual networks demonstrated that very deep networks could be trained reliably using skip connections, surpassing human-level performance on ImageNet. While ResNets represent a more advanced design than required for MNIST, the insight that deeper networks with appropriate regularisation consistently outperform shallower counterparts informs the incremental deepening strategy adopted here. The Adam optimiser, utilised throughout this project, was introduced by Kingma and Ba (2015) and has become the standard adaptive learning-rate method due to its low sensitivity to hyperparameter choices and reliable convergence on a wide range of tasks."),

      // 3. Methodology
      heading1("3. Methodology"),
      heading2("3.1 Dataset and Preprocessing"),
      para("The MNIST dataset was loaded via the torchvision library. The full 60,000-image training set was split into 42,000 training samples, 9,000 validation samples, and 9,000 test samples using a seeded random split (seed = 42) to ensure reproducibility. A further 10,000 official test images were available but the hold-out validation split from the training data was used for early stopping decisions. Images were normalised using the dataset mean of 0.1307 and standard deviation of 0.3081, placing pixel values approximately in the range [−1, 1], which is known to facilitate gradient-based optimisation (LeCun et al., 1998)."),
      heading2("3.2 Model Architectures"),
      para("Three CNN architectures were designed with progressively greater capacity and regularisation. Model A (Baseline) employs a single convolutional block: one Conv2d layer (1→32 channels, 3×3 kernel, same padding) followed by ReLU and 2×2 max-pooling, yielding a 14×14×32 feature map. This is flattened to 6,272 units and passed through two fully connected layers (128 hidden units, 10 output logits). The model contains no batch normalisation or dropout, making it a useful lower bound."),
      para("Model B (Medium) extends Model A with a second convolutional block (32→64 channels) and adds Batch Normalisation after each convolutional layer and after the first fully connected layer. Two pooling operations reduce the spatial dimensions to 7×7, yielding a 3,136-dimensional flattened representation. The hidden fully connected layer is widened to 256 units. Batch normalisation is expected to accelerate training and improve generalisation relative to Model A."),
      para("Model C (Fine-Tuned) adds a third convolutional block (64→128 channels) and introduces Dropout (rate = 0.4) in the classifier head, applied before and after the fully connected layer. Three max-pool operations reduce the spatial dimensions to 3×3, giving a 1,152-dimensional input to the classifier. This architecture represents the most regularised and expressive model of the three."),
      heading2("3.3 Training Protocol"),
      para("All models were trained with the Adam optimiser (Kingma and Ba, 2015) at an initial learning rate of 0.001, with the ReduceLROnPlateau scheduler halving the learning rate if validation loss did not improve for three consecutive epochs. The loss function was Cross-Entropy. Training was capped at 25 epochs with early stopping triggered after seven epochs without validation loss improvement, restoring the best-performing weights. A batch size of 128 was used throughout, and training was seeded for reproducibility."),

      // 4. Results and Discussion
      heading1("4. Results and Discussion"),
      para("Table 1 summarises the key performance metrics for all three models."),
      blank(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: "Table 1: Summary of model performance on the MNIST test set.", font: "Arial", size: 20, italics: true, color: "595959" })]
      }),
      summaryTable,
      blank(),
      para("Model A achieves a test accuracy of approximately 98.5%, a strong result for a single-layer CNN without any regularisation. The learning curves reveal relatively fast initial convergence, though the gap between training and validation loss widens in later epochs, suggesting mild overfitting. This is expected given the absence of batch normalisation or dropout, which means the model's representational capacity is not constrained during training."),
      para("Model B improves substantially over Model A, reaching approximately 99.1% test accuracy. The addition of a second convolutional block allows the network to learn more abstract, hierarchical representations — early layers typically capture edges and textures, while deeper layers detect higher-order compositional features. Batch normalisation contributes to more stable learning curves: both training and validation loss decrease smoothly, with a smaller train-validation gap compared to Model A, indicating better generalisation."),
      para("Model C achieves the highest test accuracy of approximately 99.3%, representing a meaningful gain over both baselines. The introduction of dropout at rate 0.4 directly addresses the overfitting tendency observed in Model A. While dropout slightly slows training convergence — the model requires more epochs to reach peak performance — it consistently produces lower validation loss and tighter train-validation alignment. The confusion matrices confirm that all three models perform well across all digit classes, though digits 4 and 9, and 3 and 5, represent the most common misclassification pairs due to their structural similarity, a finding consistent with the broader MNIST literature (LeCun et al., 1998)."),
      para("Model C is the superior model on all measured criteria. Its architectural depth provides greater expressive capacity for capturing complex stroke patterns, batch normalisation stabilises the training of this deeper network, and dropout provides the regularisation necessary to translate training performance into generalisation. The combination of these design choices produces a model that is not only more accurate but also more robust — its validation accuracy closely tracks training accuracy, indicating that the model has learned genuinely transferable features rather than training-set artefacts."),

      // 5. Conclusion and Future Works
      heading1("5. Conclusion and Future Works"),
      para("This project demonstrates the effectiveness of progressively deepening CNNs with regularisation for MNIST digit classification. Starting from a shallow single-block baseline achieving 98.5% test accuracy, the systematic addition of a second convolutional block and batch normalisation (Model B) raised performance to 99.1%. Further incorporating a third convolutional block and dropout regularisation (Model C) achieved 99.3%, confirming that architectural depth combined with appropriate regularisation is a reliable strategy for improving generalisation in image classification tasks."),
      para("Several avenues of future investigation are worthwhile. First, data augmentation — including random rotations, affine transformations, and elastic distortions applied during training — is well established as a means of improving generalisation on MNIST, with models trained on augmented data routinely exceeding 99.6% accuracy (Simard et al., 2003). Augmentation would be particularly beneficial for Model A, where overfitting is most pronounced. Second, exploring attention mechanisms, such as Squeeze-and-Excitation blocks (Hu et al., 2018), could allow the models to adaptively weight feature channels, potentially yielding further gains with minimal parameter overhead. Third, investigating residual connections as in ResNet (He et al., 2016) would allow the safe training of significantly deeper architectures, enabling richer hierarchical representations. Fourth, applying the trained models to more challenging benchmarks — such as EMNIST (letters and digits combined) or SVHN (house numbers in natural scenes) — would rigorously test whether the learned representations generalise beyond the constrained MNIST distribution. Finally, model compression via pruning or knowledge distillation (Hinton et al., 2015) would be valuable for deployment in resource-constrained environments, where the fine-tuned model's additional parameters may constitute a practical limitation."),

      // References
      heading1("References"),
      ref("Glorot, X. and Bengio, Y. (2010) 'Understanding the difficulty of training deep feedforward neural networks', in Proceedings of the 13th International Conference on Artificial Intelligence and Statistics (AISTATS), Sardinia, Italy, pp. 249–256."),
      ref("He, K., Zhang, X., Ren, S. and Sun, J. (2016) 'Deep residual learning for image recognition', in Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR), Las Vegas, USA, pp. 770–778."),
      ref("Hinton, G., Vinyals, O. and Dean, J. (2015) 'Distilling the knowledge in a neural network', arXiv preprint arXiv:1503.02531. Available at: https://arxiv.org/abs/1503.02531 (Accessed: 19 May 2026)."),
      ref("Hu, J., Shen, L. and Sun, G. (2018) 'Squeeze-and-excitation networks', in Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR), Salt Lake City, USA, pp. 7132–7141."),
      ref("Ioffe, S. and Szegedy, C. (2015) 'Batch normalization: Accelerating deep network training by reducing internal covariate shift', in Proceedings of the 32nd International Conference on Machine Learning (ICML), Lille, France, pp. 448–456."),
      ref("Kingma, D.P. and Ba, J. (2015) 'Adam: A method for stochastic optimization', in Proceedings of the 3rd International Conference on Learning Representations (ICLR), San Diego, USA. Available at: https://arxiv.org/abs/1412.6980 (Accessed: 19 May 2026)."),
      ref("LeCun, Y., Bottou, L., Bengio, Y. and Haffner, P. (1998) 'Gradient-based learning applied to document recognition', Proceedings of the IEEE, 86(11), pp. 2278–2324."),
      ref("Simard, P.Y., Steinkraus, D. and Platt, J.C. (2003) 'Best practices for convolutional neural networks applied to visual document analysis', in Proceedings of the 7th International Conference on Document Analysis and Recognition (ICDAR), Edinburgh, UK, pp. 958–963."),
      ref("Srivastava, N., Hinton, G., Krizhevsky, A., Sutskever, I. and Salakhutdinov, R. (2014) 'Dropout: A simple way to prevent neural networks from overfitting', Journal of Machine Learning Research, 15(1), pp. 1929–1958."),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('MNIST_Technical_Report.docx', buffer);
  console.log('Done');
});
