import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const LIKERT_OPTIONS = [
    { value: 5, label: 'Strongly Agree' },
    { value: 4, label: 'Agree' },
    { value: 3, label: 'Neutral' },
    { value: 2, label: 'Disagree' },
    { value: 1, label: 'Strongly Disagree' },
] as const;

const EVALUATION_SECTIONS = [
    {
        title: 'System Usability',
        questions: [
            'Is the POS system easy to use for wet market vendors?',
            'Are the buttons, labels, and menus clear and understandable?',
            'Can vendors easily add, edit, or remove products/items?',
            'Is the sales transaction process simple and fast?',
            'Can users easily search for products or items during a sale?',
        ],
    },
    {
        title: 'System Functionality',
        questions: [
            'Does the system correctly record sales transactions?',
            'Does the system accurately calculate the total amount, payment, and change?',
            'Can the system generate sales reports properly?',
            'Does the system update product inventory after every transaction?',
            'Can the system handle different types of products commonly sold in wet markets, such as meat, fish, vegetables, and fruits?',
        ],
    },
    {
        title: 'System Performance',
        questions: [
            'Does the system respond quickly when processing transactions?',
            'Can the system handle multiple transactions without lagging or crashing?',
            'Does the system load pages and reports within an acceptable time?',
            'Does the system still perform well even with many recorded products and sales?',
        ],
    },
    {
        title: 'System Reliability',
        questions: [
            'Does the system save transaction records correctly?',
            'Does the system prevent data loss during unexpected errors?',
            'Are sales and inventory records accurate after using the system?',
            'Does the system consistently produce correct results?',
        ],
    },
    {
        title: 'System Security',
        questions: [
            'Does the system require authorized login before accessing important features?',
            'Are user accounts and passwords protected?',
            'Does the system prevent unauthorized users from editing or deleting records?',
            'Are important records such as sales, products, and inventory protected from misuse?',
        ],
    },
    {
        title: 'User Satisfaction',
        questions: [
            'Does the system help vendors manage sales more efficiently?',
            'Does the system reduce manual recording errors?',
            'Does the system make daily business operations easier?',
            'Would you recommend this POS system for wet market vendors?',
        ],
    },
    {
        title: 'Overall Evaluation',
        questions: [
            'Is the system useful for wet market vendors?',
            'Does the system meet the needs of the target users?',
        ],
        textQuestions: [
            'What features of the system are most helpful?',
            'What improvements would you suggest for the system?',
        ],
    },
] as const;

const SystemEvaluation = () => {
    const router = useRouter();
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [comments, setComments] = useState<Record<string, string>>({});

    const questionTotal = useMemo(
        () => EVALUATION_SECTIONS.reduce((total, section) => total + section.questions.length, 0),
        [],
    );
    const answeredTotal = Object.keys(ratings).length;

    const handleRatingChange = (questionId: string, value: number) => {
        setRatings((current) => ({
            ...current,
            [questionId]: value,
        }));
    };

    const handleCommentChange = (questionId: string, value: string) => {
        setComments((current) => ({
            ...current,
            [questionId]: value,
        }));
    };

    const handleSubmit = () => {
        if (answeredTotal < questionTotal) {
            Alert.alert('Incomplete Evaluation', 'Please answer all rating questions before submitting.');
            return;
        }

        Alert.alert('Evaluation Submitted', 'Thank you for evaluating the POS system.');
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            <View style={styles.header}>
                <Pressable style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={34} color="#272c33" />
                </Pressable>
                <Text style={styles.headerTitle}>System Evaluation</Text>
            </View>

            <ScrollView
                style={styles.contentWrap}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.introCard}>
                    <Text style={styles.introTitle}>Likert-Scale Questionnaire</Text>
                    <Text style={styles.introText}>
                        Rate each statement based on your experience using the POS system.
                    </Text>

                    <View style={styles.scaleWrap}>
                        {LIKERT_OPTIONS.map((option) => (
                            <View key={option.value} style={styles.scaleRow}>
                                <Text style={styles.scaleNumber}>{option.value}</Text>
                                <Text style={styles.scaleLabel}>{option.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {EVALUATION_SECTIONS.map((section, sectionIndex) => (
                    <View key={section.title} style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>{section.title}</Text>

                        {section.questions.map((question, questionIndex) => {
                            const questionId = `${sectionIndex}-${questionIndex}`;

                            return (
                                <View key={questionId} style={styles.questionBlock}>
                                    <Text style={styles.questionText}>{question}</Text>

                                    <View style={styles.ratingRow}>
                                        {LIKERT_OPTIONS.map((option) => {
                                            const selected = ratings[questionId] === option.value;

                                            return (
                                                <Pressable
                                                    key={option.value}
                                                    style={[styles.ratingButton, selected && styles.ratingButtonSelected]}
                                                    onPress={() => handleRatingChange(questionId, option.value)}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.ratingButtonText,
                                                            selected && styles.ratingButtonTextSelected,
                                                        ]}
                                                    >
                                                        {option.value}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>
                            );
                        })}

                        {'textQuestions' in section &&
                            section.textQuestions.map((question, questionIndex) => {
                                const questionId = `${sectionIndex}-text-${questionIndex}`;

                                return (
                                    <View key={questionId} style={styles.questionBlock}>
                                        <Text style={styles.questionText}>{question}</Text>
                                        <TextInput
                                            style={styles.textArea}
                                            multiline
                                            textAlignVertical="top"
                                            placeholder="Write your answer here"
                                            placeholderTextColor="#8a909d"
                                            value={comments[questionId] ?? ''}
                                            onChangeText={(value) => handleCommentChange(questionId, value)}
                                        />
                                    </View>
                                );
                            })}
                    </View>
                ))}

                <View style={styles.footerCard}>
                    <Text style={styles.progressText}>
                        {answeredTotal} of {questionTotal} rating questions answered
                    </Text>
                    <Pressable style={styles.submitButton} onPress={handleSubmit}>
                        <Text style={styles.submitButtonText}>Submit Evaluation</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default SystemEvaluation;

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#dfe2ec',
    },
    header: {
        minHeight: 74,
        backgroundColor: '#f4f4f5',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#d7dae5',
    },
    backBtn: {
        marginRight: 10,
    },
    headerTitle: {
        flex: 1,
        fontSize: 26,
        fontWeight: '800',
        color: '#20252c',
    },
    contentWrap: {
        flex: 1,
        backgroundColor: '#d7dbe7',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 34,
    },
    introCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#d0d4df',
        backgroundColor: '#f4f4f5',
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    introTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#20252c',
    },
    introText: {
        marginTop: 6,
        fontSize: 15,
        lineHeight: 21,
        fontWeight: '600',
        color: '#626976',
    },
    scaleWrap: {
        marginTop: 14,
        borderRadius: 12,
        backgroundColor: '#ffffff',
        padding: 12,
    },
    scaleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 28,
    },
    scaleNumber: {
        width: 28,
        fontSize: 16,
        fontWeight: '900',
        color: '#2f5ada',
    },
    scaleLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '700',
        color: '#2a2f38',
    },
    sectionCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#d0d4df',
        backgroundColor: '#f4f4f5',
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000000',
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 21,
        fontWeight: '800',
        color: '#20252c',
        marginBottom: 10,
    },
    questionBlock: {
        borderTopWidth: 1,
        borderTopColor: '#dfe2ea',
        paddingTop: 14,
        marginTop: 14,
    },
    questionText: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '700',
        color: '#252a32',
    },
    ratingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    ratingButton: {
        width: 48,
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#c7ccd8',
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingButtonSelected: {
        borderColor: '#2f5ada',
        backgroundColor: '#2f5ada',
    },
    ratingButtonText: {
        fontSize: 17,
        fontWeight: '900',
        color: '#2f3540',
    },
    ratingButtonTextSelected: {
        color: '#ffffff',
    },
    textArea: {
        minHeight: 112,
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#c7ccd8',
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '600',
        color: '#252a32',
    },
    footerCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#d0d4df',
        backgroundColor: '#f4f4f5',
        padding: 16,
    },
    progressText: {
        marginBottom: 12,
        fontSize: 15,
        fontWeight: '700',
        color: '#626976',
        textAlign: 'center',
    },
    submitButton: {
        minHeight: 54,
        borderRadius: 12,
        backgroundColor: '#2f5ada',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 14,
    },
    submitButtonText: {
        fontSize: 19,
        fontWeight: '900',
        color: '#ffffff',
    },
});
